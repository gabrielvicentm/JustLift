const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Resend } = require('resend');
const db = require('../utils/db');

exports.getProfile = async (userId) => {
  const result = await db.query(
    `SELECT
       u.id AS user_id,
       u.username,
       up.nome_exibicao,
       up.biografia,
       up.foto_perfil,
       up.banner,
       COALESCE(up.is_private, FALSE) AS is_private,
       (
         SELECT COUNT(*)
         FROM user_follows uf
         WHERE uf.following_id = u.id
       )::INT AS followers_count,
       (
         SELECT COUNT(*)
         FROM user_follows uf
         WHERE uf.follower_id = u.id
       )::INT AS following_count,
       u.created_at
     FROM users u
     LEFT JOIN users_profile up ON up.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    throw new Error('USER_NOT_FOUND');
  }

  return result.rows[0];
};

exports.updateProfile = async (userId, nome_exibicao, biografia, foto_perfil, banner, isPrivate = null) => {
  const result = await db.query(
    `INSERT INTO users_profile (user_id, nome_exibicao, biografia, foto_perfil, banner, is_private)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, FALSE))
     ON CONFLICT (user_id)
     DO UPDATE SET
       nome_exibicao = EXCLUDED.nome_exibicao,
       biografia = EXCLUDED.biografia,
       foto_perfil = EXCLUDED.foto_perfil,
       banner = EXCLUDED.banner,
       is_private = COALESCE($6, users_profile.is_private)
     RETURNING user_id, nome_exibicao, biografia, foto_perfil, banner, is_private`,
    [userId, nome_exibicao, biografia, foto_perfil, banner, isPrivate]
  );

  if (result.rows.length === 0) {
    throw new Error('USER_NOT_FOUND');
  }

  return result.rows[0];
};

exports.getProfileByUsern = async (requestUserId, username) => {
  const safeUsername = String(username || '').trim();

  const result = await db.query(
    `SELECT
       u.id AS user_id,
       u.username,
       up.nome_exibicao,
       up.biografia,
       up.foto_perfil,
       up.banner,
       COALESCE(up.is_private, FALSE) AS is_private,
       (
         SELECT COUNT(*)
         FROM user_follows uf
         WHERE uf.following_id = u.id
       )::INT AS followers_count,
       (
         SELECT COUNT(*)
         FROM user_follows uf
         WHERE uf.follower_id = u.id
       )::INT AS following_count,
       (
         EXISTS (
           SELECT 1
           FROM user_follows uf
           WHERE uf.follower_id = $1
             AND uf.following_id = u.id
         )
       ) AS is_following,
       (
         EXISTS (
           SELECT 1
           FROM follow_requests fr
           WHERE fr.requester_id = $1
             AND fr.target_id = u.id
             AND fr.status = 'pending'
         )
       ) AS has_pending_follow_request,
       (u.id = $1) AS is_me,
       u.created_at
     FROM users u
     LEFT JOIN users_profile up ON up.user_id = u.id
     WHERE lower(u.username) = lower($2)
     LIMIT 1`,
    [requestUserId, safeUsername]
  );

  if (result.rows.length === 0) {
    throw new Error('USER_NOT_FOUND');
  }

  const profile = result.rows[0];

  if (profile.is_private && !profile.is_me && !profile.is_following) {
    profile.biografia = null;
    profile.banner = null;
  }

  return profile;
};

const VERIFICATION_CODE_EXPIRATION_MINUTES = Number(process.env.EMAIL_VERIFICATION_EXPIRES_MINUTES || 10);
const VERIFICATION_MAX_ATTEMPTS = Number(process.env.EMAIL_VERIFICATION_MAX_ATTEMPTS || 5);
const VERIFICATION_CODE_SECRET = process.env.EMAIL_VERIFICATION_CODE_SECRET || process.env.JWT_SECRET || 'pantufa';

const generateVerificationCode = () => String(Math.floor(100000 + Math.random() * 900000));
const hashVerificationCode = (code) =>
  crypto.createHash('sha256').update(`${code}:${VERIFICATION_CODE_SECRET}`).digest('hex');

const sendAccountChangeCodeEmail = async (email, username, code) => {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    throw new Error('EMAIL_PROVIDER_NOT_CONFIGURED');
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to: [email],
    subject: 'Codigo para alterar conta - JustLift',
    text: `Oi ${username}, seu codigo para alterar dados da conta e ${code}. Expira em ${VERIFICATION_CODE_EXPIRATION_MINUTES} minutos.`,
  });
};

exports.requestAccountChange = async (userId, { newUsername, newEmail, newPassword }) => {
  const userResult = await db.query('SELECT id, username, email FROM users WHERE id = $1', [userId]);
  const user = userResult.rows[0];
  if (!user) throw new Error('USER_NOT_FOUND');

  const nextUsername = (newUsername || '').trim() || null;
  const nextEmail = (newEmail || '').trim().toLowerCase() || null;
  const nextPassword = (newPassword || '').trim() || null;

  if (!nextUsername && !nextEmail && !nextPassword) throw new Error('NOTHING_TO_UPDATE');

  if (nextUsername && nextUsername !== user.username) {
    const dup = await db.query('SELECT 1 FROM users WHERE username = $1 AND id <> $2 LIMIT 1', [nextUsername, userId]);
    if (dup.rows.length) throw new Error('DUPLICATE_USERNAME');
  }

  if (nextEmail && nextEmail !== user.email) {
    const dup = await db.query('SELECT 1 FROM users WHERE email = $1 AND id <> $2 LIMIT 1', [nextEmail, userId]);
    if (dup.rows.length) throw new Error('DUPLICATE_EMAIL');
  }

  const newPasswordHash = nextPassword ? bcrypt.hashSync(nextPassword, 10) : null;

  const code = generateVerificationCode();
  const codeHash = hashVerificationCode(code);

  await db.query(
    `
      INSERT INTO account_change_verifications
      (user_id, new_username, new_email, new_password_hash, verification_code_hash, attempts, expires_at, last_sent_at, updated_at)
      VALUES
      ($1, $2, $3, $4, $5, 0, NOW() + ($6::INT * INTERVAL '1 minute'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id)
      DO UPDATE SET
        new_username = EXCLUDED.new_username,
        new_email = EXCLUDED.new_email,
        new_password_hash = EXCLUDED.new_password_hash,
        verification_code_hash = EXCLUDED.verification_code_hash,
        attempts = 0,
        expires_at = EXCLUDED.expires_at,
        last_sent_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    `,
    [userId, nextUsername, nextEmail, newPasswordHash, codeHash, VERIFICATION_CODE_EXPIRATION_MINUTES]
  );

  await sendAccountChangeCodeEmail(user.email, user.username, code);
};

exports.confirmAccountChange = async (userId, code) => {
  const pendingResult = await db.query('SELECT * FROM account_change_verifications WHERE user_id = $1', [userId]);
  const pending = pendingResult.rows[0];
  if (!pending) throw new Error('VERIFICATION_NOT_FOUND');

  if (new Date(pending.expires_at).getTime() < Date.now()) {
    await db.query('DELETE FROM account_change_verifications WHERE user_id = $1', [userId]);
    throw new Error('VERIFICATION_EXPIRED');
  }

  const providedHash = hashVerificationCode(code);
  if (providedHash !== pending.verification_code_hash) {
    const nextAttempts = Number(pending.attempts) + 1;
    await db.query(
      'UPDATE account_change_verifications SET attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1',
      [userId]
    );

    if (nextAttempts >= VERIFICATION_MAX_ATTEMPTS) {
      await db.query('DELETE FROM account_change_verifications WHERE user_id = $1', [userId]);
      throw new Error('VERIFICATION_TOO_MANY_ATTEMPTS');
    }

    throw new Error('INVALID_VERIFICATION_CODE');
  }

  await db.query(
    `
      UPDATE users
      SET
        username = COALESCE($2, username),
        email = COALESCE($3, email),
        senha = COALESCE($4, senha)
      WHERE id = $1
    `,
    [userId, pending.new_username, pending.new_email, pending.new_password_hash]
  );

  await db.query('DELETE FROM account_change_verifications WHERE user_id = $1', [userId]);
};
