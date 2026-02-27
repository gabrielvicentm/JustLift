const db = require('../utils/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET_KEY = 'pantufa'; // Em producao, use variavel de ambiente.

exports.createSession = async (userId) => {
  const accessToken = jwt.sign({ userId }, SECRET_KEY, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId }, SECRET_KEY, { expiresIn: '7d' });

  await db.query('UPDATE users SET refresh_token = $1 WHERE id = $2', [refreshToken, userId]);

  return { accessToken, refreshToken };
};

exports.createUser = async (username, email, senha) => {
  const duplicateQuery = `
      SELECT username, email FROM users WHERE username = $1 OR email = $2`;

  const duplicateResults = await db.query(duplicateQuery, [username, email]);
  if (duplicateResults.rows.length > 0) {
    throw new Error('DUPLICATE_USER');
  }

  const hashed = bcrypt.hashSync(senha, 10);

  await db.query('INSERT INTO users (username, email, senha) VALUES ($1, $2, $3)', [
    username,
    email,
    hashed,
  ]);
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

    const passwordMatch = bcrypt.compareSync(senha, user.senha);

    if (!passwordMatch) {
      throw new Error('INVALID_CREDENTIALS');
    }
    const SECRET_KEY = "pantufa"; // Em produção, use uma variável de ambiente para isso

    const accessToken = jwt.sign(
      { userId: user.id },      // payload
      SECRET_KEY,               // chave secreta
      { expiresIn: "1d" }      // tempo de expiração
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      SECRET_KEY,
      { expiresIn: "7d" }
    );

    // Atualiza o refresh_token no banco de dados
    await db.query(
      'UPDATE users SET refresh_token = $1 WHERE id = $2',
      [refreshToken, user.id]
    );

    return { accessToken, refreshToken };
  
};

exports.refreshToken = async (refreshToken) => {
  const decoded = jwt.verify(refreshToken, SECRET_KEY);

  const user = await db.query(
    "SELECT * FROM users WHERE id = $1",
    [decoded.userId]
  );

  if (user.rows.length === 0) {
    throw new Error('USER_NOT_FOUND');
  }

  if (user.rows[0].refresh_token !== refreshToken) {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  const newAccessToken = jwt.sign(
    { userId: user.rows[0].id },
    SECRET_KEY,
    { expiresIn: "1d" }
  );

  const newRefreshToken = jwt.sign(
    { userId: user.rows[0].id },
    SECRET_KEY,
    { expiresIn: "7d" }
  );

  await db.query('UPDATE users SET refresh_token = $1 WHERE id = $2', [
    newRefreshToken,
    user.rows[0].id,
  ]);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};
