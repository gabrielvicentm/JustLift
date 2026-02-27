const db = require('../utils/db');

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
