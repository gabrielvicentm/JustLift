const { Pool } = require('pg');

const numberFromEnv = (envName, fallback) => {
  const value = Number(process.env[envName]);
  return Number.isFinite(value) ? value : fallback;
};

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'fightclub',
  database: process.env.DB_NAME || 'dev_db',
  port: numberFromEnv('DB_PORT', 5432),
  max: numberFromEnv('DB_POOL_MAX', 20),
  idleTimeoutMillis: numberFromEnv('DB_IDLE_TIMEOUT_MS', 10000),
  connectionTimeoutMillis: numberFromEnv('DB_CONNECTION_TIMEOUT_MS', 5000),
  statement_timeout: numberFromEnv('DB_STATEMENT_TIMEOUT_MS', 10000),
  query_timeout: numberFromEnv('DB_QUERY_TIMEOUT_MS', 10000),
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Erro ao conectar ao banco PostgreSQL:', err.stack);
  } else {
    console.log('Conectado ao banco PostgreSQL!');
  }
});

module.exports = pool;

