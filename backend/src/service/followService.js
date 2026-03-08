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
  const unfollowResult = await db.query(
    `DELETE FROM user_follows
     WHERE follower_id = $1
       AND following_id = $2`,
    [userId, targetUserId]
  );

  if (unfollowResult.rowCount > 0) {
    return { status: 'unfollowed' };
  }

  const cancelRequestResult = await db.query(
    `UPDATE follow_requests
     SET status = 'canceled',
         updated_at = CURRENT_TIMESTAMP
     WHERE requester_id = $1
       AND target_id = $2
       AND status = 'pending'`,
    [userId, targetUserId]
  );

  if (cancelRequestResult.rowCount > 0) {
    return { status: 'request_canceled' };
  }

  return { status: 'not_found' };
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
    `SELECT
       u.id,
       COALESCE(up.is_private, FALSE) AS is_private,
       EXISTS (
         SELECT 1
         FROM user_follows uf
         WHERE uf.follower_id = $1
           AND uf.following_id = u.id
       ) AS already_following,
       EXISTS (
         SELECT 1
         FROM follow_requests fr
         WHERE fr.requester_id = $1
           AND fr.target_id = u.id
           AND fr.status = 'pending'
       ) AS already_requested
     FROM users u
     LEFT JOIN users_profile up ON up.user_id = u.id
     WHERE u.id = $2
     LIMIT 1`,
    [userId, targetUserId]
  );

  if (targetUser.rows.length === 0) {
    throw new Error('USER_NOT_FOUND');
  }

  const target = targetUser.rows[0];
  if (target.already_following) {
    return { status: 'already_following' };
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    if (target.is_private) {
      if (target.already_requested) {
        await client.query('COMMIT');
        return { status: 'already_requested' };
      }

      const requestResult = await client.query(
        `INSERT INTO follow_requests (requester_id, target_id, status)
         VALUES ($1, $2, 'pending')
         ON CONFLICT (requester_id, target_id)
         DO UPDATE SET
           status = 'pending',
           updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [userId, targetUserId]
      );

      const followRequestId = requestResult.rows[0]?.id || null;
      if (followRequestId) {
        await client.query(
          `INSERT INTO notifications (recipient_id, actor_id, follow_request_id, type)
           VALUES ($1, $2, $3, 'follow_request')`,
          [targetUserId, userId, followRequestId]
        );
      }

      await client.query('COMMIT');
      return { status: 'requested' };
    }

    await client.query(
      `INSERT INTO user_follows (follower_id, following_id)
       VALUES ($1, $2)
       ON CONFLICT (follower_id, following_id)
       DO NOTHING`,
      [userId, targetUserId]
    );

    await client.query(
      `INSERT INTO notifications (recipient_id, actor_id, type)
       VALUES ($1, $2, 'new_follower')`,
      [targetUserId, userId]
    );

    await client.query('COMMIT');
    return { status: 'following' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.listIncomingFollowRequests = async ({ userId, limit, offset }) => {
  const safeLimit = normalizeLimit(limit);
  const safeOffset = normalizeOffset(offset);

  const result = await db.query(
    `SELECT
       fr.id,
       fr.requester_id AS user_id,
       u.username,
       up.nome_exibicao,
       up.foto_perfil,
       fr.created_at AS requested_at
     FROM follow_requests fr
     INNER JOIN users u ON u.id = fr.requester_id
     LEFT JOIN users_profile up ON up.user_id = u.id
     WHERE fr.target_id = $1
       AND fr.status = 'pending'
     ORDER BY fr.created_at DESC, fr.id DESC
     LIMIT $2 OFFSET $3`,
    [userId, safeLimit, safeOffset]
  );

  return result.rows;
};

exports.acceptFollowRequest = async ({ userId, requestId }) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const requestResult = await client.query(
      `SELECT id, requester_id, target_id
       FROM follow_requests
       WHERE id = $1
         AND target_id = $2
         AND status = 'pending'
       LIMIT 1
       FOR UPDATE`,
      [requestId, userId]
    );

    if (requestResult.rows.length === 0) {
      throw new Error('FOLLOW_REQUEST_NOT_FOUND');
    }

    const request = requestResult.rows[0];

    const followInsert = await client.query(
      `INSERT INTO user_follows (follower_id, following_id)
       VALUES ($1, $2)
       ON CONFLICT (follower_id, following_id)
       DO NOTHING`,
      [request.requester_id, request.target_id]
    );

    await client.query(
      `UPDATE follow_requests
       SET status = 'accepted',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [request.id]
    );

    await client.query(
      `UPDATE notifications
       SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
       WHERE follow_request_id = $1
         AND recipient_id = $2`,
      [request.id, userId]
    );

    if (followInsert.rowCount > 0) {
      await client.query(
        `INSERT INTO notifications (recipient_id, actor_id, type)
         VALUES ($1, $2, 'new_follower')`,
        [request.target_id, request.requester_id]
      );
    }

    await client.query('COMMIT');
    return { status: 'accepted' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.rejectFollowRequest = async ({ userId, requestId }) => {
  const result = await db.query(
    `UPDATE follow_requests
     SET status = 'rejected',
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
       AND target_id = $2
       AND status = 'pending'
     RETURNING id`,
    [requestId, userId]
  );

  if (result.rowCount === 0) {
    throw new Error('FOLLOW_REQUEST_NOT_FOUND');
  }

  await db.query(
    `UPDATE notifications
     SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
     WHERE follow_request_id = $1
       AND recipient_id = $2`,
    [requestId, userId]
  );

  return { status: 'rejected' };
};

exports.listNotifications = async ({ userId, limit, offset }) => {
  const safeLimit = normalizeLimit(limit);
  const safeOffset = normalizeOffset(offset);

  const result = await db.query(
    `SELECT
       n.id,
       n.type,
       n.follow_request_id,
       n.read_at,
       n.created_at,
       fr.status AS follow_request_status,
       u.id AS actor_id,
       u.username AS actor_username,
       up.nome_exibicao AS actor_nome_exibicao,
       up.foto_perfil AS actor_foto_perfil
     FROM notifications n
     LEFT JOIN follow_requests fr ON fr.id = n.follow_request_id
     INNER JOIN users u ON u.id = n.actor_id
     LEFT JOIN users_profile up ON up.user_id = u.id
     WHERE n.recipient_id = $1
     ORDER BY n.created_at DESC, n.id DESC
     LIMIT $2 OFFSET $3`,
    [userId, safeLimit, safeOffset]
  );

  return result.rows;
};

exports.countUnreadNotifications = async ({ userId }) => {
  const result = await db.query(
    `SELECT COUNT(*)::INT AS total
     FROM notifications
     WHERE recipient_id = $1
       AND read_at IS NULL`,
    [userId]
  );

  return result.rows[0]?.total || 0;
};

exports.markNotificationAsRead = async ({ userId, notificationId }) => {
  const result = await db.query(
    `UPDATE notifications
     SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
     WHERE id = $1
       AND recipient_id = $2
     RETURNING id`,
    [notificationId, userId]
  );

  return result.rowCount > 0;
};

exports.markAllNotificationsAsRead = async ({ userId }) => {
  const result = await db.query(
    `UPDATE notifications
     SET read_at = CURRENT_TIMESTAMP
     WHERE recipient_id = $1
       AND read_at IS NULL`,
    [userId]
  );

  return result.rowCount;
};
