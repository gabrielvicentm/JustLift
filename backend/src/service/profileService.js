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

exports.getMyWorkoutPosts = async (userId, { limit = 20, offset = 0 } = {}) => {
  const userExists = await db.query('SELECT 1 FROM users WHERE id = $1', [userId]);
  if (userExists.rows.length === 0) {
    throw new Error('USER_NOT_FOUND');
  }

  const result = await db.query(
    `SELECT
       t.treino_id AS id,
       t.user_id,
       t.data,
       t.duracao,
       t.peso_total,
       t.total_series,
       t.finalizado,
       COUNT(DISTINCT edt.exercicio_treino_id) AS total_exercicios
     FROM treinos t
     LEFT JOIN exercicios_do_treino edt ON edt.treino_id = t.treino_id
     WHERE t.user_id = $1
     GROUP BY t.treino_id, t.user_id, t.data, t.duracao, t.peso_total, t.total_series, t.finalizado
     ORDER BY t.data DESC, t.treino_id DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  return result.rows;
};

exports.updateMyWorkoutPost = async (userId, postId, { data, duracao, finalizado }) => {
  const userExists = await db.query('SELECT 1 FROM users WHERE id = $1', [userId]);
  if (userExists.rows.length === 0) {
    throw new Error('USER_NOT_FOUND');
  }

  const updates = [];
  const values = [];
  let idx = 1;

  if (data !== undefined) {
    updates.push(`data = $${idx}`);
    values.push(data);
    idx += 1;
  }

  if (duracao !== undefined) {
    updates.push(`duracao = $${idx}`);
    values.push(duracao);
    idx += 1;
  }

  if (finalizado !== undefined) {
    updates.push(`finalizado = $${idx}`);
    values.push(finalizado);
    idx += 1;
  }

  if (updates.length === 0) {
    throw new Error('NOTHING_TO_UPDATE');
  }

  values.push(postId);
  values.push(userId);

  const result = await db.query(
    `UPDATE treinos
     SET ${updates.join(', ')}
     WHERE treino_id = $${idx} AND user_id = $${idx + 1}
     RETURNING treino_id AS id, user_id, data, duracao, peso_total, total_series, finalizado`,
    values
  );

  if (result.rows.length === 0) {
    throw new Error('POST_NOT_FOUND');
  }

  return result.rows[0];
};

exports.deleteMyWorkoutPost = async (userId, postId) => {
  const userExists = await db.query('SELECT 1 FROM users WHERE id = $1', [userId]);
  if (userExists.rows.length === 0) {
    throw new Error('USER_NOT_FOUND');
  }

  const result = await db.query(
    `DELETE FROM treinos
     WHERE treino_id = $1 AND user_id = $2
     RETURNING treino_id`,
    [postId, userId]
  );

  if (result.rows.length === 0) {
    throw new Error('POST_NOT_FOUND');
  }

  return { id: result.rows[0].treino_id };
};

exports.updateProfile = async (userId, nome_exibicao, biografia, foto_perfil, banner) => {
  const result = await db.query(
    `INSERT INTO users_profile (user_id, nome_exibicao, biografia, foto_perfil, banner)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id)
     DO UPDATE SET
       nome_exibicao = EXCLUDED.nome_exibicao,
       biografia = EXCLUDED.biografia,
       foto_perfil = EXCLUDED.foto_perfil,
       banner = EXCLUDED.banner
     RETURNING user_id, nome_exibicao, biografia, foto_perfil, banner`,
    [userId, nome_exibicao, biografia, foto_perfil, banner]
  );

  if (result.rows.length === 0) {
    throw new Error('USER_NOT_FOUND');
  }

  return result.rows[0];
};
