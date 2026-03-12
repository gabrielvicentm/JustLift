const db = require('../utils/db');
const notificationService = require('./notificationService');

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

  if (result.rowCount > 0) {
    try {
      await notificationService.deleteUserFollowNotification({
        recipientUserId: targetUserId,
        actorUserId: userId,
      });
    } catch (err) {
      console.error('Erro ao remover notificação de follow:', err);
    }
  }

  return result.rowCount > 0;
};

exports.removeFollower = async ({ userId, followerUserId }) => {
  const result = await db.query(
    `DELETE FROM user_follows
     WHERE follower_id = $1
       AND following_id = $2`,
    [followerUserId, userId]
  );

  if (result.rowCount > 0) {
    try {
      await notificationService.deleteUserFollowNotification({
        recipientUserId: userId,
        actorUserId: followerUserId,
      });
    } catch (err) {
      console.error('Erro ao remover notificacao de follow:', err);
    }
  }

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

  if (result.rowCount > 0) {
    try {
      await notificationService.createUserFollowNotification({
        recipientUserId: targetUserId,
        actorUserId: userId,
      });
    } catch (err) {
      console.error('Erro ao criar notificacao de follow:', err);
    }
  }

  return result.rowCount > 0;
};

exports.requestFollow = async ({ userId, targetUserId }) => {
  if (userId === targetUserId) {
    throw new Error('CANNOT_FOLLOW_SELF');
  }

  const targetUser = await db.query(
    `SELECT id
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [targetUserId],
  );

  if (targetUser.rows.length === 0) {
    throw new Error('USER_NOT_FOUND');
  }

  const alreadyFollowing = await db.query(
    `SELECT 1 FROM user_follows WHERE follower_id = $1 AND following_id = $2 LIMIT 1`,
    [userId, targetUserId],
  );

  if (alreadyFollowing.rows.length > 0) {
    return { created: false, reason: 'ALREADY_FOLLOWING' };
  }

  const result = await db.query(
    `INSERT INTO follow_requests (requester_id, target_user_id)
     VALUES ($1, $2)
     ON CONFLICT (requester_id, target_user_id)
     DO NOTHING`,
    [userId, targetUserId],
  );

  if (result.rowCount > 0) {
    try {
      await notificationService.createFollowRequestNotification({
        recipientUserId: targetUserId,
        actorUserId: userId,
      });
    } catch (err) {
      console.error('Erro ao criar notificacao de follow_request:', err);
    }
  }

  return { created: result.rowCount > 0 };
};

exports.listIncomingFollowRequests = async ({ userId, limit, offset }) => {
  const safeLimit = normalizeLimit(limit);
  const safeOffset = normalizeOffset(offset);

  const result = await db.query(
    `SELECT
       fr.id,
       fr.requester_id,
       u.username,
       up.nome_exibicao,
       up.foto_perfil,
       fr.created_at
     FROM follow_requests fr
     JOIN users u ON u.id = fr.requester_id
     LEFT JOIN users_profile up ON up.user_id = u.id
     WHERE fr.target_user_id = $1
     ORDER BY fr.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, safeLimit, safeOffset],
  );

  return result.rows;
};

exports.acceptFollowRequest = async ({ userId, requestId }) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const request = await client.query(
      `SELECT requester_id, target_user_id
       FROM follow_requests
       WHERE id = $1
       LIMIT 1`,
      [requestId],
    );

    if (request.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const { requester_id: requesterId, target_user_id: targetUserId } = request.rows[0];
    if (targetUserId !== userId) {
      await client.query('ROLLBACK');
      throw new Error('NOT_ALLOWED');
    }

    await client.query(
      `INSERT INTO user_follows (follower_id, following_id)
       VALUES ($1, $2)
       ON CONFLICT (follower_id, following_id)
       DO NOTHING`,
      [requesterId, targetUserId],
    );

    await client.query(
      `DELETE FROM follow_requests
       WHERE id = $1`,
      [requestId],
    );

    await client.query('COMMIT');

    try {
      await notificationService.deleteFollowRequestNotification({
        recipientUserId: targetUserId,
        actorUserId: requesterId,
      });
      await notificationService.createFollowAcceptedNotification({
        recipientUserId: requesterId,
        actorUserId: targetUserId,
      });
    } catch (err) {
      console.error('Erro ao criar notificacao de follow_accepted:', err);
    }

    return { requesterId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.declineFollowRequest = async ({ userId, requestId }) => {
  const reqInfo = await db.query(
    `SELECT requester_id
     FROM follow_requests
     WHERE id = $1
       AND target_user_id = $2
     LIMIT 1`,
    [requestId, userId],
  );

  if (reqInfo.rows.length === 0) {
    return false;
  }

  const result = await db.query(
    `DELETE FROM follow_requests
     WHERE id = $1
       AND target_user_id = $2`,
    [requestId, userId],
  );

  if (result.rowCount > 0) {
    try {
      const requesterId = reqInfo.rows[0]?.requester_id;
      if (requesterId) {
        await notificationService.deleteFollowRequestNotification({
          recipientUserId: userId,
          actorUserId: requesterId,
        });
      }
    } catch (err) {
      console.error('Erro ao remover notificacao de follow_request:', err);
    }
  }

  return result.rowCount > 0;
};
