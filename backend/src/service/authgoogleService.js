const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const db = require('../utils/db');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const verifyGoogleIdToken = async (googleIdToken, providedGoogleId) => {
  console.log('[GoogleAuth][Service] verifyGoogleIdToken:start', {
    hasGoogleClientId: Boolean(process.env.GOOGLE_CLIENT_ID),
    hasProvidedGoogleId: Boolean(providedGoogleId),
    idTokenLength: googleIdToken?.length ?? 0,
  });

  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new Error('CONFIG_ERROR');
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: googleIdToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  const googleId = payload?.sub;
  const email = payload?.email;
  const googleName = payload?.name;

  console.log('[GoogleAuth][Service] verifyGoogleIdToken:payload', {
    googleId,
    email,
    googleName,
  });

  if (!googleId || !email) {
    throw new Error('INVALID_GOOGLE_TOKEN');
  }

  if (providedGoogleId && providedGoogleId !== googleId) {
    throw new Error('GOOGLE_ID_MISMATCH');
  }

  return { googleId, email, googleName };
};

exports.loginWithGoogle = async (googleIdToken, providedGoogleId) => {
  console.log('[GoogleAuth][Service] loginWithGoogle:start');
  const { googleId, email } = await verifyGoogleIdToken(googleIdToken, providedGoogleId);

  const result = await db.query('SELECT * FROM users WHERE google_id = $1 OR email = $2 LIMIT 1', [
    googleId,
    email,
  ]);
  console.log('[GoogleAuth][Service] loginWithGoogle:userQuery', {
    rowsLength: result.rows.length,
    googleId,
    email,
  });

  const user = result.rows[0];
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  if (user.google_id && user.google_id !== googleId) {
    throw new Error('GOOGLE_ID_MISMATCH');
  }

  if (!user.google_id) {
    console.log('[GoogleAuth][Service] loginWithGoogle:bindingGoogleId', { userId: user.id, googleId });
    await db.query('UPDATE users SET google_id = $1 WHERE id = $2', [googleId, user.id]);
  }

  console.log('[GoogleAuth][Service] loginWithGoogle:success', { userId: user.id, googleId });
  return { userId: user.id, googleId };
};

exports.registerWithGoogle = async (username, googleIdToken, providedGoogleId) => {
  console.log('[GoogleAuth][Service] registerWithGoogle:start', {
    incomingUsername: username ?? null,
  });

  const { googleId, email, googleName } = await verifyGoogleIdToken(googleIdToken, providedGoogleId);

  const safeUsername = (username || googleName || email.split('@')[0] || '').trim();
  console.log('[GoogleAuth][Service] registerWithGoogle:computedUsername', { safeUsername });

  if (!safeUsername) {
    throw new Error('INVALID_USERNAME');
  }

  const duplicateResult = await db.query(
    'SELECT id FROM users WHERE username = $1 OR email = $2 OR google_id = $3',
    [safeUsername, email, googleId]
  );

  console.log('[GoogleAuth][Service] registerWithGoogle:duplicateQuery', {
    rowsLength: duplicateResult.rows.length,
    rows: duplicateResult.rows,
  });

  if (duplicateResult.rows.length > 0) {
    throw new Error('DUPLICATE_USER');
  }

  const randomPassword = `google_${googleId}_${Date.now()}`;
  const hashedPassword = bcrypt.hashSync(randomPassword, 10);

  const createdUser = await db.query(
    'INSERT INTO users (username, email, senha, google_id) VALUES ($1, $2, $3, $4) RETURNING id',
    [safeUsername, email, hashedPassword, googleId]
  );

  const userId = createdUser.rows[0].id;
  console.log('[GoogleAuth][Service] registerWithGoogle:success', { userId, googleId });

  return { userId, googleId };
};
