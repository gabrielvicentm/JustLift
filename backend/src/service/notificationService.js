const db = require('../utils/db');
const pushService = require('./pushNotificationService');

const NOTIFICATION_TYPES = {
  POST_LIKE: 'post_like',
  POST_SAVE: 'post_save',
  POST_COMMENT: 'post_comment',
  USER_FOLLOW: 'user_follow',
  FOLLOW_REQUEST: 'follow_request',
  FOLLOW_ACCEPTED: 'follow_accepted',
  COMMENT_LIKE: 'comment_like',
  MENTION: 'mention',
};

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

function normalizeLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_LIMIT;
  }
  return Math.max(1, Math.min(Math.floor(parsed), MAX_LIMIT));
}

function normalizeOffset(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.floor(parsed));
}

exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;

async function getActorName(userId) {
  const result = await db.query(
    `
      SELECT COALESCE(up.nome_exibicao, u.username) AS name
      FROM users u
      LEFT JOIN users_profile up ON up.user_id = u.id
      WHERE u.id = $1
      LIMIT 1
    `,
    [userId],
  );

  return result.rows[0]?.name || 'Alguem';
}

exports.createPostLikeNotification = async ({ recipientUserId, actorUserId, postId }) => {
  if (!recipientUserId || !actorUserId || !postId) {
    return;
  }

  if (recipientUserId === actorUserId) {
    return;
  }

  await db.query(
    `
      DELETE FROM notifications
      WHERE recipient_user_id = $1
        AND actor_user_id = $2
        AND post_id = $3
        AND type = $4
    `,
    [recipientUserId, actorUserId, postId, NOTIFICATION_TYPES.POST_LIKE],
  );

  await db.query(
    `
      INSERT INTO notifications (
        recipient_user_id,
        actor_user_id,
        post_id,
        type
      )
      VALUES ($1, $2, $3, $4)
    `,
    [recipientUserId, actorUserId, postId, NOTIFICATION_TYPES.POST_LIKE],
  );

  const actorName = await getActorName(actorUserId);
  await pushService.sendPushToUser({
    userId: recipientUserId,
    title: 'Curtida no post',
    body: `${actorName} curtiu seu post.`,
    data: { type: NOTIFICATION_TYPES.POST_LIKE, postId },
  });
};

exports.deletePostLikeNotification = async ({ recipientUserId, actorUserId, postId }) => {
  if (!recipientUserId || !actorUserId || !postId) {
    return;
  }

  await db.query(
    `
      DELETE FROM notifications
      WHERE recipient_user_id = $1
        AND actor_user_id = $2
        AND post_id = $3
        AND type = $4
    `,
    [recipientUserId, actorUserId, postId, NOTIFICATION_TYPES.POST_LIKE],
  );
};

exports.createPostCommentNotification = async ({ recipientUserId, actorUserId, postId, commentId }) => {
  if (!recipientUserId || !actorUserId || !postId) {
    return;
  }

  if (recipientUserId === actorUserId) {
    return;
  }

  await db.query(
    `
      INSERT INTO notifications (
        recipient_user_id,
        actor_user_id,
        post_id,
        comment_id,
        type
      )
      VALUES ($1, $2, $3, $4, $5)
    `,
    [recipientUserId, actorUserId, postId, commentId || null, NOTIFICATION_TYPES.POST_COMMENT],
  );

  const actorName = await getActorName(actorUserId);
  await pushService.sendPushToUser({
    userId: recipientUserId,
    title: 'Novo comentario',
    body: `${actorName} comentou no seu post.`,
    data: { type: NOTIFICATION_TYPES.POST_COMMENT, postId, commentId },
  });
};

exports.createPostSaveNotification = async ({ recipientUserId, actorUserId, postId }) => {
  if (!recipientUserId || !actorUserId || !postId) {
    return;
  }

  if (recipientUserId === actorUserId) {
    return;
  }

  await db.query(
    `
      DELETE FROM notifications
      WHERE recipient_user_id = $1
        AND actor_user_id = $2
        AND post_id = $3
        AND type = $4
    `,
    [recipientUserId, actorUserId, postId, NOTIFICATION_TYPES.POST_SAVE],
  );

  await db.query(
    `
      INSERT INTO notifications (
        recipient_user_id,
        actor_user_id,
        post_id,
        type
      )
      VALUES ($1, $2, $3, $4)
    `,
    [recipientUserId, actorUserId, postId, NOTIFICATION_TYPES.POST_SAVE],
  );

  const actorName = await getActorName(actorUserId);
  await pushService.sendPushToUser({
    userId: recipientUserId,
    title: 'Post salvo',
    body: `${actorName} salvou seu post.`,
    data: { type: NOTIFICATION_TYPES.POST_SAVE, postId },
  });
};

exports.deletePostSaveNotification = async ({ recipientUserId, actorUserId, postId }) => {
  if (!recipientUserId || !actorUserId || !postId) {
    return;
  }

  await db.query(
    `
      DELETE FROM notifications
      WHERE recipient_user_id = $1
        AND actor_user_id = $2
        AND post_id = $3
        AND type = $4
    `,
    [recipientUserId, actorUserId, postId, NOTIFICATION_TYPES.POST_SAVE],
  );
};

exports.createUserFollowNotification = async ({ recipientUserId, actorUserId }) => {
  if (!recipientUserId || !actorUserId) {
    return;
  }

  if (recipientUserId === actorUserId) {
    return;
  }

  await db.query(
    `
      DELETE FROM notifications
      WHERE recipient_user_id = $1
        AND actor_user_id = $2
        AND type = $3
    `,
    [recipientUserId, actorUserId, NOTIFICATION_TYPES.USER_FOLLOW],
  );

  await db.query(
    `
      INSERT INTO notifications (
        recipient_user_id,
        actor_user_id,
        post_id,
        type
      )
      VALUES ($1, $2, NULL, $3)
    `,
    [recipientUserId, actorUserId, NOTIFICATION_TYPES.USER_FOLLOW],
  );

  const actorName = await getActorName(actorUserId);
  await pushService.sendPushToUser({
    userId: recipientUserId,
    title: 'Novo seguidor',
    body: `${actorName} começou a seguir você.`,
    data: { type: NOTIFICATION_TYPES.USER_FOLLOW },
  });
};

exports.deleteUserFollowNotification = async ({ recipientUserId, actorUserId }) => {
  if (!recipientUserId || !actorUserId) {
    return;
  }

  await db.query(
    `
      DELETE FROM notifications
      WHERE recipient_user_id = $1
        AND actor_user_id = $2
        AND type = $3
    `,
    [recipientUserId, actorUserId, NOTIFICATION_TYPES.USER_FOLLOW],
  );
};

exports.createFollowRequestNotification = async ({ recipientUserId, actorUserId }) => {
  if (!recipientUserId || !actorUserId || recipientUserId === actorUserId) {
    return;
  }

  await db.query(
    `
      DELETE FROM notifications
      WHERE recipient_user_id = $1
        AND actor_user_id = $2
        AND type = $3
    `,
    [recipientUserId, actorUserId, NOTIFICATION_TYPES.FOLLOW_REQUEST],
  );

  await db.query(
    `
      INSERT INTO notifications (
        recipient_user_id,
        actor_user_id,
        post_id,
        type
      )
      VALUES ($1, $2, NULL, $3)
    `,
    [recipientUserId, actorUserId, NOTIFICATION_TYPES.FOLLOW_REQUEST],
  );

  const actorName = await getActorName(actorUserId);
  await pushService.sendPushToUser({
    userId: recipientUserId,
    title: 'Pedido de follow',
    body: `${actorName} pediu para seguir você.`,
    data: { type: NOTIFICATION_TYPES.FOLLOW_REQUEST },
  });
};

exports.deleteFollowRequestNotification = async ({ recipientUserId, actorUserId }) => {
  if (!recipientUserId || !actorUserId) {
    return;
  }

  await db.query(
    `
      DELETE FROM notifications
      WHERE recipient_user_id = $1
        AND actor_user_id = $2
        AND type = $3
    `,
    [recipientUserId, actorUserId, NOTIFICATION_TYPES.FOLLOW_REQUEST],
  );
};

exports.createFollowAcceptedNotification = async ({ recipientUserId, actorUserId }) => {
  if (!recipientUserId || !actorUserId || recipientUserId === actorUserId) {
    return;
  }

  await db.query(
    `
      INSERT INTO notifications (
        recipient_user_id,
        actor_user_id,
        post_id,
        type
      )
      VALUES ($1, $2, NULL, $3)
    `,
    [recipientUserId, actorUserId, NOTIFICATION_TYPES.FOLLOW_ACCEPTED],
  );

  const actorName = await getActorName(actorUserId);
  await pushService.sendPushToUser({
    userId: recipientUserId,
    title: 'Pedido aceito',
    body: `${actorName} aceitou seu pedido de follow.`,
    data: { type: NOTIFICATION_TYPES.FOLLOW_ACCEPTED },
  });
};

exports.createCommentLikeNotification = async ({ recipientUserId, actorUserId, postId, commentId }) => {
  if (!recipientUserId || !actorUserId || recipientUserId === actorUserId) {
    return;
  }

  await db.query(
    `
      DELETE FROM notifications
      WHERE recipient_user_id = $1
        AND actor_user_id = $2
        AND comment_id = $3
        AND type = $4
    `,
    [recipientUserId, actorUserId, commentId, NOTIFICATION_TYPES.COMMENT_LIKE],
  );

  await db.query(
    `
      INSERT INTO notifications (
        recipient_user_id,
        actor_user_id,
        post_id,
        comment_id,
        type
      )
      VALUES ($1, $2, $3, $4, $5)
    `,
    [recipientUserId, actorUserId, postId, commentId, NOTIFICATION_TYPES.COMMENT_LIKE],
  );

  const actorName = await getActorName(actorUserId);
  await pushService.sendPushToUser({
    userId: recipientUserId,
    title: 'Curtida no comentario',
    body: `${actorName} curtiu seu comentario.`,
    data: { type: NOTIFICATION_TYPES.COMMENT_LIKE, postId, commentId },
  });
};

exports.deleteCommentLikeNotification = async ({ recipientUserId, actorUserId, commentId }) => {
  if (!recipientUserId || !actorUserId || !commentId) {
    return;
  }

  await db.query(
    `
      DELETE FROM notifications
      WHERE recipient_user_id = $1
        AND actor_user_id = $2
        AND comment_id = $3
        AND type = $4
    `,
    [recipientUserId, actorUserId, commentId, NOTIFICATION_TYPES.COMMENT_LIKE],
  );
};

exports.createMentionNotification = async ({ recipientUserId, actorUserId, postId, commentId }) => {
  if (!recipientUserId || !actorUserId || recipientUserId === actorUserId) {
    return;
  }

  await db.query(
    `
      INSERT INTO notifications (
        recipient_user_id,
        actor_user_id,
        post_id,
        comment_id,
        type
      )
      VALUES ($1, $2, $3, $4, $5)
    `,
    [recipientUserId, actorUserId, postId || null, commentId || null, NOTIFICATION_TYPES.MENTION],
  );

  const actorName = await getActorName(actorUserId);
  await pushService.sendPushToUser({
    userId: recipientUserId,
    title: 'Mencao',
    body: `${actorName} mencionou voce.`,
    data: { type: NOTIFICATION_TYPES.MENTION, postId, commentId },
  });
};

exports.listByRecipient = async ({ recipientUserId, limit, offset }) => {
  const safeLimit = normalizeLimit(limit);
  const safeOffset = normalizeOffset(offset);

  const result = await db.query(
    `
      SELECT
        n.id,
        n.type,
        n.post_id,
        n.comment_id,
        n.created_at,
        n.read_at,
        n.actor_user_id,
        u.username AS actor_username,
        up.nome_exibicao AS actor_nome_exibicao,
        up.foto_perfil AS actor_foto_perfil,
        p.descricao AS post_descricao
      FROM notifications n
      JOIN users u ON u.id = n.actor_user_id
      LEFT JOIN users_profile up ON up.user_id = u.id
      LEFT JOIN posts p ON p.post_id = n.post_id
      WHERE n.recipient_user_id = $1
      ORDER BY n.created_at DESC, n.id DESC
      LIMIT $2
      OFFSET $3
    `,
    [recipientUserId, safeLimit, safeOffset],
  );

  return result.rows;
};

exports.countUnreadByRecipient = async ({ recipientUserId }) => {
  const result = await db.query(
    `
      SELECT COUNT(*)::INT AS unread_count
      FROM notifications
      WHERE recipient_user_id = $1
        AND read_at IS NULL
    `,
    [recipientUserId],
  );

  return result.rows[0]?.unread_count || 0;
};

exports.registerPushToken = async ({ userId, token, platform, deviceId }) => {
  await db.query(
    `
      INSERT INTO user_push_tokens (
        user_id,
        token,
        platform,
        device_id
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, token)
      DO UPDATE SET
        platform = EXCLUDED.platform,
        device_id = EXCLUDED.device_id,
        updated_at = CURRENT_TIMESTAMP
    `,
    [userId, token, platform || 'unknown', deviceId],
  );
};

exports.unregisterPushToken = async ({ userId, token }) => {
  await db.query(
    `
      DELETE FROM user_push_tokens
      WHERE user_id = $1
        AND token = $2
    `,
    [userId, token],
  );
};

exports.markAsRead = async ({ notificationId, recipientUserId }) => {
  const result = await db.query(
    `
      UPDATE notifications
      SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
      WHERE id = $1
        AND recipient_user_id = $2
      RETURNING id
    `,
    [notificationId, recipientUserId],
  );

  return result.rowCount > 0;
};

exports.markAllAsRead = async ({ recipientUserId }) => {
  await db.query(
    `
      UPDATE notifications
      SET read_at = CURRENT_TIMESTAMP
      WHERE recipient_user_id = $1
        AND read_at IS NULL
    `,
    [recipientUserId],
  );
};
