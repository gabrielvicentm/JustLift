const { Pool } = require('pg');

const pool = new Pool({
  host:'localhost',
  user: 'postgres',
  password: 'fightclub',
  database: 'dev_db',
  port: '5432',
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Erro ao conectar ao banco PostgreSQL:', err.stack);
  } else {
    console.log('Conectado ao banco PostgreSQL!');
  }
});

module.exports = pool;


