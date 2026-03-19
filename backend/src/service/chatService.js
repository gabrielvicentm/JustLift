const db = require('../utils/db');
const { ensureChatTables } = require('./conversasService');

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;
const EDIT_WINDOW_MINUTES = 5;

const normalizeLimit = (value) => { //pega value que vem da URL
  const parsed = Number(value); //tenta converter para número
  if (!Number.isFinite(parsed)) { //se nao conseguir retorna o valor padrão
    return DEFAULT_LIMIT;
  }
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(parsed))); //isso basicamente nao deixa o nunero do limite quebrar(redundante)
};

const normalizeOffset = (value) => { // isso garante que o offset seja valido para carregar as mensagfens aos poucos
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.floor(parsed)); //remove o decimal e impede os negativos
};

const normalizeContent = (value) => String(value || '').trim();
const normalizeMessageId = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('INVALID_MESSAGE');
  }

  return Math.floor(parsed);
};
const isSameUser = (left, right) => String(left) === String(right);

const getChatTarget = async (userId, targetUserId) => {
  if (!targetUserId) {
    throw new Error('USER_NOT_FOUND');
  }

  if (String(userId) === String(targetUserId)) {
    throw new Error('CANNOT_CHAT_WITH_SELF');
  }

  const targetResult = await db.query(
    `SELECT
       u.id AS user_id,
       u.username,
       up.nome_exibicao,
       up.foto_perfil
     FROM users u
     LEFT JOIN users_profile up ON up.user_id = u.id
     WHERE u.id = $1
     LIMIT 1`,
    [targetUserId]
  );

  const targetUser = targetResult.rows[0];
  if (!targetUser) {
    throw new Error('USER_NOT_FOUND');
  }

  return targetUser;
};

const getBlockStatus = async (userId, targetUserId) => {
  const result = await db.query(
    `SELECT
       EXISTS (
         SELECT 1
         FROM blocked_users
         WHERE blocker_id = $1
           AND blocked_id = $2
       ) AS is_blocked_by_me,
       EXISTS (
         SELECT 1
         FROM blocked_users
         WHERE blocker_id = $2
           AND blocked_id = $1
       ) AS has_blocked_me`,
    [userId, targetUserId]
  );

  return {
    isBlockedByMe: Boolean(result.rows[0]?.is_blocked_by_me),
    hasBlockedMe: Boolean(result.rows[0]?.has_blocked_me),
  };
};

const getChatMessageById = async (messageId) => {
  const result = await db.query(
    `SELECT
       dm.id,
       dm.sender_id,
       dm.recipient_id,
       dm.content,
       dm.read_at,
       dm.reply_to_message_id,
       dm.edited_at,
       dm.deleted_for_everyone_at,
       dm.created_at,
       dm.updated_at,
       reply.id AS reply_message_id,
       reply.content AS reply_content,
       reply.sender_id AS reply_sender_id
     FROM chat dm
     LEFT JOIN chat reply
       ON reply.id = dm.reply_to_message_id
      AND reply.deleted_for_everyone_at IS NULL
     WHERE dm.id = $1
     LIMIT 1`,
    [messageId]
  );

  return result.rows[0] || null;
};

const mapMessageRow = (row) => ({
  id: row.id,
  sender_id: row.sender_id,
  recipient_id: row.recipient_id,
  content: row.deleted_for_everyone_at ? 'Mensagem apagada' : row.content,
  read_at: row.read_at,
  reply_to_message_id: row.deleted_for_everyone_at ? null : row.reply_to_message_id,
  reply_to_content: row.deleted_for_everyone_at ? null : (row.reply_content || null),
  reply_to_sender_id: row.deleted_for_everyone_at ? null : (row.reply_sender_id || null),
  edited_at: row.edited_at,
  deleted_for_everyone_at: row.deleted_for_everyone_at,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const assertMessageBelongsToChat = (message, userId, targetUserId) => {
  if (!message) {
    throw new Error('MESSAGE_NOT_FOUND');
  }

  const belongsToChat =
    (isSameUser(message.sender_id, userId) && isSameUser(message.recipient_id, targetUserId))
    || (isSameUser(message.sender_id, targetUserId) && isSameUser(message.recipient_id, userId));

  if (!belongsToChat) {
    throw new Error('MESSAGE_NOT_FOUND');
  }
};

exports.getMessages = async ({ userId, targetUserId, limit, offset }) => {
  await ensureChatTables();

  const targetUser = await getChatTarget(userId, targetUserId);
  const blockStatus = await getBlockStatus(userId, targetUserId);
  const safeLimit = normalizeLimit(limit);
  const safeOffset = normalizeOffset(offset);

  if (!blockStatus.isBlockedByMe) {
    await db.query(
      `UPDATE chat
       SET read_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE sender_id = $1
         AND recipient_id = $2
         AND read_at IS NULL`,
      [targetUserId, userId]
    );
  }

  const result = await db.query(
    `SELECT *
     FROM (
       SELECT
         dm.id,
         dm.sender_id,
         dm.recipient_id,
         dm.content,
         dm.read_at,
         dm.reply_to_message_id,
         reply.content AS reply_content,
         reply.sender_id AS reply_sender_id,
         dm.edited_at,
         dm.deleted_for_everyone_at,
         dm.created_at,
         dm.updated_at
       FROM chat dm
       LEFT JOIN chat reply
         ON reply.id = dm.reply_to_message_id
        AND reply.deleted_for_everyone_at IS NULL
       WHERE
         (
           (dm.sender_id = $1 AND dm.recipient_id = $2)
           OR
           (dm.sender_id = $2 AND dm.recipient_id = $1)
         )
         AND (
           NOT $5
           OR dm.sender_id <> $2
         )
         AND NOT EXISTS (
           SELECT 1
           FROM hidden_chat_messages hcm
           WHERE hcm.user_id = $1
             AND hcm.message_id = dm.id
         )
       ORDER BY dm.created_at DESC, dm.id DESC
       LIMIT $3 OFFSET $4
     ) messages
     ORDER BY created_at ASC, id ASC`,
    [userId, targetUserId, safeLimit, safeOffset, blockStatus.isBlockedByMe]
  );

  return {
    targetUser: {
      ...targetUser,
      is_blocked_by_me: blockStatus.isBlockedByMe,
      has_blocked_me: blockStatus.hasBlockedMe,
    },
    messages: result.rows.map(mapMessageRow),
  };
};

exports.sendMessage = async ({ userId, targetUserId, content, replyToMessageId }) => {
  await ensureChatTables();

  const targetUser = await getChatTarget(userId, targetUserId);
  const blockStatus = await getBlockStatus(userId, targetUserId);
  const safeContent = normalizeContent(content);
  const safeReplyToMessageId = normalizeMessageId(replyToMessageId);

  if (!safeContent) {
    throw new Error('EMPTY_MESSAGE');
  }

  if (blockStatus.isBlockedByMe || blockStatus.hasBlockedMe) {
    throw new Error('CHAT_BLOCKED');
  }

  if (safeReplyToMessageId) {
    const replyTarget = await getChatMessageById(safeReplyToMessageId);
    assertMessageBelongsToChat(replyTarget, userId, targetUserId);

    if (replyTarget.deleted_for_everyone_at) {
      throw new Error('MESSAGE_NOT_FOUND');
    }
  }

  const result = await db.query(
    `INSERT INTO chat (sender_id, recipient_id, content, reply_to_message_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [userId, targetUserId, safeContent, safeReplyToMessageId]
  );

  await db.query(
    `DELETE FROM hidden_conversations
     WHERE
       (user_id = $1 AND other_user_id = $2)
       OR
       (user_id = $2 AND other_user_id = $1)`,
    [userId, targetUserId]
  );

  return {
    targetUser: {
      ...targetUser,
      is_blocked_by_me: blockStatus.isBlockedByMe,
      has_blocked_me: blockStatus.hasBlockedMe,
    },
    message: mapMessageRow(await getChatMessageById(result.rows[0].id)),
  };
};

exports.updateMessage = async ({ userId, targetUserId, messageId, content }) => {
  await ensureChatTables();

  const targetUser = await getChatTarget(userId, targetUserId);
  const blockStatus = await getBlockStatus(userId, targetUserId);
  const safeContent = normalizeContent(content);
  const safeMessageId = normalizeMessageId(messageId);

  if (!safeContent) {
    throw new Error('EMPTY_MESSAGE');
  }

  if (blockStatus.isBlockedByMe || blockStatus.hasBlockedMe) {
    throw new Error('CHAT_BLOCKED');
  }

  const message = await getChatMessageById(safeMessageId);
  assertMessageBelongsToChat(message, userId, targetUserId);

  if (!isSameUser(message.sender_id, userId)) {
    throw new Error('MESSAGE_NOT_OWNED');
  }

  if (message.deleted_for_everyone_at) {
    throw new Error('MESSAGE_NOT_FOUND');
  }

  const ageMs = Date.now() - new Date(message.created_at).getTime();
  if (ageMs > EDIT_WINDOW_MINUTES * 60 * 1000) {
    throw new Error('EDIT_WINDOW_EXPIRED');
  }

  await db.query(
    `UPDATE chat
     SET content = $1,
         edited_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [safeContent, safeMessageId]
  );

  return {
    targetUser: {
      ...targetUser,
      is_blocked_by_me: blockStatus.isBlockedByMe,
      has_blocked_me: blockStatus.hasBlockedMe,
    },
    message: mapMessageRow(await getChatMessageById(safeMessageId)),
  };
};

exports.deleteMessageForMe = async ({ userId, targetUserId, messageId }) => {
  await ensureChatTables();

  await getChatTarget(userId, targetUserId);
  const safeMessageId = normalizeMessageId(messageId);
  const message = await getChatMessageById(safeMessageId);
  assertMessageBelongsToChat(message, userId, targetUserId);

  if (message.deleted_for_everyone_at) {
    throw new Error('MESSAGE_NOT_FOUND');
  }

  await db.query(
    `INSERT INTO hidden_chat_messages (user_id, message_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, message_id)
     DO UPDATE SET hidden_at = CURRENT_TIMESTAMP`,
    [userId, safeMessageId]
  );
};

exports.deleteMessageForEveryone = async ({ userId, targetUserId, messageId }) => {
  await ensureChatTables();

  await getChatTarget(userId, targetUserId);
  const safeMessageId = normalizeMessageId(messageId);
  const message = await getChatMessageById(safeMessageId);
  assertMessageBelongsToChat(message, userId, targetUserId);

  if (!isSameUser(message.sender_id, userId)) {
    throw new Error('MESSAGE_NOT_OWNED');
  }

  if (message.deleted_for_everyone_at) {
    throw new Error('MESSAGE_NOT_FOUND');
  }

  await db.query(
    `UPDATE chat
     SET deleted_for_everyone_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [safeMessageId]
  );
};
