const db = require('../utils/db');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const normalizeLimit = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_LIMIT;
  }
  return Math.max(1, Math.min(parsed, MAX_LIMIT));
};

const normalizeOffset = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.floor(parsed));
};

const normalizeSearch = (value) => String(value || '').trim();

exports.listFollowers = async ({ userId, search, limit, offset }) => {
  const safeSearch = normalizeSearch(search);
  const safeLimit = normalizeLimit(limit);
  const safeOffset = normalizeOffset(offset);
  const likeSearch = `%${safeSearch}%`;

  const result = await db.query(
    `SELECT
       u.id AS user_id,
       u.username,
       up.nome_exibicao,
       up.foto_perfil,
       uf.created_at AS followed_at
     FROM user_follows uf
     INNER JOIN users u ON u.id = uf.follower_id
     LEFT JOIN users_profile up ON up.user_id = u.id
     WHERE uf.following_id = $1
       AND (
         $2 = ''
         OR u.username ILIKE $3
         OR COALESCE(up.nome_exibicao, '') ILIKE $3
       )
     ORDER BY uf.created_at DESC, u.username ASC
     LIMIT $4 OFFSET $5`,
    [userId, safeSearch, likeSearch, safeLimit, safeOffset]
  );

  return result.rows;
};

exports.listFollowing = async ({ userId, search, limit, offset }) => {
  const safeSearch = normalizeSearch(search);
  const safeLimit = normalizeLimit(limit);
  const safeOffset = normalizeOffset(offset);
  const likeSearch = `%${safeSearch}%`;

  const result = await db.query(
    `SELECT
       u.id AS user_id,
       u.username,
       up.nome_exibicao,
       up.foto_perfil,
       uf.created_at AS followed_at
     FROM user_follows uf
     INNER JOIN users u ON u.id = uf.following_id
     LEFT JOIN users_profile up ON up.user_id = u.id
     WHERE uf.follower_id = $1
       AND (
         $2 = ''
         OR u.username ILIKE $3
         OR COALESCE(up.nome_exibicao, '') ILIKE $3
       )
     ORDER BY uf.created_at DESC, u.username ASC
     LIMIT $4 OFFSET $5`,
    [userId, safeSearch, likeSearch, safeLimit, safeOffset]
  );

  return result.rows;
};

exports.unfollow = async ({ userId, targetUserId }) => {
  const result = await db.query(
    `DELETE FROM user_follows
     WHERE follower_id = $1
       AND following_id = $2`,
    [userId, targetUserId]
  );

  return result.rowCount > 0;
};

exports.removeFollower = async ({ userId, followerUserId }) => {
  const result = await db.query(
    `DELETE FROM user_follows
     WHERE follower_id = $1
       AND following_id = $2`,
    [followerUserId, userId]
  );

  return result.rowCount > 0;
};

exports.follow = async ({ userId, targetUserId }) => {
  if (userId === targetUserId) {
    throw new Error('CANNOT_FOLLOW_SELF');
  }

  const targetUser = await db.query(
    `SELECT id
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [targetUserId]
  );

  if (targetUser.rows.length === 0) {
    throw new Error('USER_NOT_FOUND');
  }

  const result = await db.query(
    `INSERT INTO user_follows (follower_id, following_id)
     VALUES ($1, $2)
     ON CONFLICT (follower_id, following_id)
     DO NOTHING`,
    [userId, targetUserId]
  );

  return result.rowCount > 0;
};
