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

async function getNotifications(userId, { limit, offset } = {}) {
  const safeLimit = normalizeLimit(limit);
  const safeOffset = normalizeOffset(offset);
  const result = await db.query(`
    SELECT
      n.*,
      u.username AS actor_username,
      up.nome_exibicao AS actor_nome_exibicao,
      up.foto_perfil AS actor_foto_perfil
    FROM notifications n
    LEFT JOIN users u ON u.id = n.actor_id
    LEFT JOIN users_profile up ON up.user_id = u.id
    WHERE n.recipient_id = $1
    ORDER BY n.created_at DESC
    LIMIT $2 OFFSET $3
  `, [userId, safeLimit, safeOffset]);

  return result.rows;
}

async function getUnreadCount(userId) {
  const result = await db.query(`
    SELECT COUNT(*)::INT AS total
    FROM notifications
    WHERE recipient_id = $1
    AND read_at IS NULL
  `, [userId]);

  return result.rows[0]?.total || 0;
}

async function markAsRead(userId, notificationId) {
  const result = await db.query(`
    UPDATE notifications
    SET read_at = NOW()
    WHERE id = $1
    AND recipient_id = $2
    RETURNING id
  `, [notificationId, userId]);

  return result.rowCount > 0;
}

async function createNotification({
  recipientId,
  actorId,
  type,
  data = {},
}, client = db) {
  const result = await client.query(`
    INSERT INTO notifications (
      recipient_id,
      actor_id,
      type,
      data
    )
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `, [recipientId, actorId, type, data]);

  return result.rows[0];
}

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  createNotification
};

