const db = require('../utils/db');
const { ensureChatTables } = require('./conversasService');

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

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

exports.getMessages = async ({ userId, targetUserId, limit, offset }) => {
  await ensureChatTables();

  const targetUser = await getChatTarget(userId, targetUserId);
  const blockStatus = await getBlockStatus(userId, targetUserId);
  const safeLimit = normalizeLimit(limit);
  const safeOffset = normalizeOffset(offset);

  if (blockStatus.hasBlockedMe && !isSameUser(userId, targetUserId)) {
    throw new Error('CHAT_BLOCKED');
  }

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
         dm.created_at,
         dm.updated_at
       FROM chat dm
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
    messages: result.rows,
  };
};

exports.sendMessage = async ({ userId, targetUserId, content }) => {
  await ensureChatTables();

  const targetUser = await getChatTarget(userId, targetUserId);
  const blockStatus = await getBlockStatus(userId, targetUserId);
  const safeContent = normalizeContent(content);

  if (!safeContent) {
    throw new Error('EMPTY_MESSAGE');
  }

  if (blockStatus.isBlockedByMe || blockStatus.hasBlockedMe) {
    throw new Error('CHAT_BLOCKED');
  }

  const result = await db.query(
    `INSERT INTO chat (sender_id, recipient_id, content)
     VALUES ($1, $2, $3)
     RETURNING id, sender_id, recipient_id, content, read_at, created_at, updated_at`,
    [userId, targetUserId, safeContent]
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
    message: result.rows[0],
  };
};
