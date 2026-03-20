const requireEnv = (name) => {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`MISSING_ENV_${name}`);
  }
  return value;
};

const JWT_ACCESS_SECRET = String(process.env.JWT_ACCESS_SECRET || '').trim();
const JWT_REFRESH_SECRET = String(process.env.JWT_REFRESH_SECRET || '').trim();

if (!JWT_ACCESS_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error('JWT_SECRET_NOT_CONFIGURED');
}

const JWT_ACCESS_EXPIRES = String(process.env.JWT_ACCESS_EXPIRES || '15m').trim();
const JWT_REFRESH_EXPIRES = String(process.env.JWT_REFRESH_EXPIRES || '7d').trim();

const EMAIL_VERIFICATION_CODE_SECRET = String(
  process.env.EMAIL_VERIFICATION_CODE_SECRET || '',
).trim();

const REFRESH_TOKEN_PEPPER = String(process.env.REFRESH_TOKEN_PEPPER || '').trim();

if (!EMAIL_VERIFICATION_CODE_SECRET) {
  throw new Error('EMAIL_VERIFICATION_CODE_SECRET_NOT_CONFIGURED');
}

if (!REFRESH_TOKEN_PEPPER) {
  throw new Error('REFRESH_TOKEN_PEPPER_NOT_CONFIGURED');
}

module.exports = {
  JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRES,
  JWT_REFRESH_EXPIRES,
  EMAIL_VERIFICATION_CODE_SECRET,
  REFRESH_TOKEN_PEPPER,
};
