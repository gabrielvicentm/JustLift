const db = require('../utils/db');

exports.searchUsersByUsername = async (currentUserId, query, limit = 20) => {
  const trimmedQuery = String(query || '').trim();// nao entendi pq tem que garantir que vire string
  if (!trimmedQuery) { //Se busca estiver vazia (não consulta o banco) retorna lista vazia
    return [];
  }

  const numericLimit = Number(limit); //converter limit (que vem como string da URL) para número.
  const safeLimit = Number.isFinite(numericLimit) ? Math.max(1, Math.min(numericLimit, 50)) : 20;
  //(54)valida e limita o valor para evitar abuso; se for número válido: força ficar entre 1 e 50; se inválido usa padrão (20)
  const likeQuery = `%${trimmedQuery}%`;
  //(56) monta o padrão para ILike; % = qualquer coisa
  //ex: rich vira %rich%, encontrando richard, ri, richard12, 1richard1, r1ch4rd, etc

  const result = await db.query(
    `SELECT
       u.id AS user_id,
       u.username,
       up.nome_exibicao,
       up.foto_perfil
     FROM users u
     LEFT JOIN users_profile up ON up.user_id = u.id
     WHERE u.id <> $1
       AND (
         u.username ILIKE $2
         OR COALESCE(up.nome_exibicao, '') ILIKE $2
       )
     ORDER BY
       CASE WHEN lower(u.username) = lower($3) THEN 0 ELSE 1 END,
       CASE WHEN lower(u.username) LIKE lower($3) || '%' THEN 0 ELSE 1 END,
       CASE
         WHEN lower(COALESCE(up.nome_exibicao, '')) = lower($3) THEN 0
         ELSE 1
       END,
       CASE
         WHEN lower(COALESCE(up.nome_exibicao, '')) LIKE lower($3) || '%' THEN 0
         ELSE 1
       END,
       u.username ASC
     LIMIT $4`,
    [currentUserId, likeQuery, trimmedQuery, safeLimit]
  );

  return result.rows;
};
