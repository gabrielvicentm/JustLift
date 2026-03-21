const db = require('../utils/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Resend } = require('resend');

const {
  JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRES,
  JWT_REFRESH_EXPIRES,
  EMAIL_VERIFICATION_CODE_SECRET,
  REFRESH_TOKEN_PEPPER,
} = require('../config/security');

const VERIFICATION_CODE_EXPIRATION_MINUTES = Number(process.env.EMAIL_VERIFICATION_EXPIRES_MINUTES || 10);
const VERIFICATION_MAX_ATTEMPTS = Number(process.env.EMAIL_VERIFICATION_MAX_ATTEMPTS || 5);
const VERIFICATION_RESEND_COOLDOWN_SECONDS = Number.isFinite(
  Number(process.env.EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS),
)
  ? Number(process.env.EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS)
  : 60;

const generateVerificationCode = () =>
  String(crypto.randomInt(0, 1000000)).padStart(6, '0');


const hashVerificationCode = (code) =>
  crypto.createHash('sha256').update(`${code}:${EMAIL_VERIFICATION_CODE_SECRET}`).digest('hex');

const hashRefreshToken = (token) =>
  crypto.createHmac('sha256', REFRESH_TOKEN_PEPPER).update(token).digest('hex');
// Embaralha o codigo com uma chave secreta pra guardar no banco sem mostrar o codigo real.
//SHA-256 é uma função que pega qualquer texto e transforma em uma “impressão digital”
//devolve em formato texto hexadecimal (hex)


//scapeHtml é um “faxineiro de texto” antes de jogar algo dentro de HTML.
//Se o usuário escrever algo malicioso tipo:
//<script>alert('hack')</script>
//Sem escapeHtml, isso pode virar código dentro do email/página.
const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

    

const sendVerificationEmail = async (email, username, code) => {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    throw new Error('EMAIL_PROVIDER_NOT_CONFIGURED');
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const safeUsername = escapeHtml(username); //Limpa o nome do usuário para usar no HTML sem risco.
  const subject = 'Codigo de verificacao - JustLift';
  const text = `Oi ${username}, seu codigo de verificacao no JustLift e ${code}. Este codigo expira em ${VERIFICATION_CODE_EXPIRATION_MINUTES} minutos.`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <h2>Verificacao de email - JustLift</h2>
      <p>Oi <strong>${safeUsername}</strong>,</p>
      <p>Use este codigo para confirmar seu cadastro:</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px;">${code}</p>
      <p>Esse codigo expira em ${VERIFICATION_CODE_EXPIRATION_MINUTES} minutos.</p>
    </div>
  `;

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to: [email],
    subject,
    text,
    html,
  });
};

const validateDuplicatesInUsers = async (username, email) => {
  const duplicateResults = await db.query(
    'SELECT username, email FROM users WHERE username = $1 OR email = $2',
    [username, email]
  );

  if (duplicateResults.rows.length > 0) {
    throw new Error('DUPLICATE_USER');
  }
};

exports.createSession = async (userId) => {
  const accessToken = jwt.sign({ userId }, JWT_ACCESS_SECRET, { expiresIn: JWT_ACCESS_EXPIRES });
  const refreshToken = jwt.sign({ userId }, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES });
  const refreshTokenHash = hashRefreshToken(refreshToken);

  await db.query('UPDATE users SET refresh_token = $1 WHERE id = $2', [refreshTokenHash, userId]);

  return { accessToken, refreshToken };
};

exports.createUser = async (username, email, senha) => {
  await validateDuplicatesInUsers(username, email);

  const hashedPassword = bcrypt.hashSync(senha, 10);
  const code = generateVerificationCode();
  const codeHash = hashVerificationCode(code);

  await db.query(
    `
      INSERT INTO email_verifications (
        email, username, senha_hash, verification_code_hash, attempts, expires_at, last_sent_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, 0, NOW() + ($5::INT * INTERVAL '1 minute'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT (email)
      DO UPDATE SET
        username = EXCLUDED.username,
        senha_hash = EXCLUDED.senha_hash,
        verification_code_hash = EXCLUDED.verification_code_hash,
        attempts = 0,
        expires_at = EXCLUDED.expires_at,
        last_sent_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    `,
    [email, username, hashedPassword, codeHash, VERIFICATION_CODE_EXPIRATION_MINUTES]
  );

  await sendVerificationEmail(email, username, code);
};

exports.verifyEmailAndCreateUser = async (email, code) => {
  const verificationResult = await db.query('SELECT * FROM email_verifications WHERE email = $1', [email]);
  const pending = verificationResult.rows[0];

  if (!pending) {
    throw new Error('VERIFICATION_NOT_FOUND');
  }

  if (new Date(pending.expires_at).getTime() < Date.now()) {
    throw new Error('VERIFICATION_EXPIRED');
  }

  const providedHash = hashVerificationCode(code);
  if (providedHash !== pending.verification_code_hash) {
    const nextAttempts = Number(pending.attempts) + 1;
    await db.query(
      'UPDATE email_verifications SET attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP WHERE email = $1',
      [email]
    );

    if (nextAttempts >= VERIFICATION_MAX_ATTEMPTS) {
      await db.query('DELETE FROM email_verifications WHERE email = $1', [email]);
      throw new Error('VERIFICATION_TOO_MANY_ATTEMPTS');
    }

    throw new Error('INVALID_VERIFICATION_CODE');
  }

  await validateDuplicatesInUsers(pending.username, pending.email);

  await db.query('INSERT INTO users (username, email, senha) VALUES ($1, $2, $3)', [
    pending.username,
    pending.email,
    pending.senha_hash,
  ]);

  await db.query('DELETE FROM email_verifications WHERE email = $1', [email]);
};

exports.resendVerificationCode = async (email) => {
  const verificationResult = await db.query('SELECT * FROM email_verifications WHERE email = $1', [email]);
  const pending = verificationResult.rows[0];

  if (!pending) {
    throw new Error('VERIFICATION_NOT_FOUND');
  }

  const isExpired = new Date(pending.expires_at).getTime() < Date.now();
  const lastSent = new Date(pending.last_sent_at).getTime();
  const secondsSinceLastSend = Math.floor((Date.now() - lastSent) / 1000);
  if (secondsSinceLastSend < VERIFICATION_RESEND_COOLDOWN_SECONDS) {
    throw new Error('VERIFICATION_RESEND_TOO_SOON');
  }

  const code = generateVerificationCode();
  const codeHash = hashVerificationCode(code);

  await db.query(
    `
      UPDATE email_verifications
      SET
        verification_code_hash = $2,
        attempts = 0,
        expires_at = NOW() + ($3::INT * INTERVAL '1 minute'),
        last_sent_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE email = $1
    `,
    [email, codeHash, VERIFICATION_CODE_EXPIRATION_MINUTES]
  );

  await sendVerificationEmail(email, pending.username, code);
  return { expired: isExpired };
};

exports.logar = async (identifier, senha) => {
  const query = identifier.includes('@')
    ? 'SELECT * FROM users WHERE email = $1'
    : 'SELECT * FROM users WHERE username = $1';

  const results = await db.query(query, [identifier]);
  const user = results.rows[0];

  if (!user) {
    throw new Error('INVALID_CREDENTIALS');
  }

  if (user.google_id) {
    throw new Error('GOOGLE_LOGIN_REQUIRED');
  }

  const passwordMatch = bcrypt.compareSync(senha, user.senha);

  if (!passwordMatch) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const accessToken = jwt.sign({ userId: user.id }, JWT_ACCESS_SECRET, { expiresIn: JWT_ACCESS_EXPIRES });
  const refreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES });
  const refreshTokenHash = hashRefreshToken(refreshToken);

  await db.query('UPDATE users SET refresh_token = $1 WHERE id = $2', [refreshTokenHash, user.id]);

  return { accessToken, refreshToken };
};

exports.refreshToken = async (refreshToken) => {
  const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);

  const user = await db.query('SELECT * FROM users WHERE id = $1', [decoded.userId]);

  if (user.rows.length === 0) {
    throw new Error('USER_NOT_FOUND');
  }

  const storedToken = user.rows[0].refresh_token;
  const providedHash = hashRefreshToken(refreshToken);
  const matchesHashed = storedToken === providedHash;
  const matchesLegacy = storedToken === refreshToken;

  if (!matchesHashed && !matchesLegacy) {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  const newAccessToken = jwt.sign(
    { userId: user.rows[0].id },
    JWT_ACCESS_SECRET,
    { expiresIn: JWT_ACCESS_EXPIRES },
  );
  const newRefreshToken = jwt.sign(
    { userId: user.rows[0].id },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES },
  );
  const newRefreshTokenHash = hashRefreshToken(newRefreshToken);

  await db.query('UPDATE users SET refresh_token = $1 WHERE id = $2', [
    newRefreshTokenHash,
    user.rows[0].id,
  ]);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

exports.logout = async (refreshToken) => {
  const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);

  const user = await db.query('SELECT * FROM users WHERE id = $1', [decoded.userId]);

  if (user.rows.length === 0) {
    throw new Error('USER_NOT_FOUND');
  }

  const storedToken = user.rows[0].refresh_token;
  const providedHash = hashRefreshToken(refreshToken);
  const matchesHashed = storedToken === providedHash;
  const matchesLegacy = storedToken === refreshToken;

  if (!matchesHashed && !matchesLegacy) {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  await db.query('UPDATE users SET refresh_token = NULL WHERE id = $1', [decoded.userId]);
};
