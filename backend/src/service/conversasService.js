const db = require('../utils/db');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50; 

let ensureTablesPromise = null;
const MAX_PINNED_CONVERSATIONS = 5;

const normalizeLimit = (value) => { //pega value que vem da URL
  const parsed = Number(value); //tenta converter para número
  if (!Number.isFinite(parsed)) { //se nao conseguir retorna o valor padrão
    return DEFAULT_LIMIT;
  }

  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(parsed))); ////isso basicamente nao deixa o nunero do limite quebrar(redundante)
};

const normalizeOffset = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.floor(parsed));
};

const normalizeSearch = (value) => String(value || '').trim();

const ensureChatTables = async () => {
  if (!ensureTablesPromise) {
    ensureTablesPromise = (async () => {
      await db.query(`
        CREATE TABLE IF NOT EXISTS chat (
          id BIGSERIAL PRIMARY KEY,
          sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          read_at TIMESTAMPTZ NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_chat_sender_recipient_created_at
        ON chat (sender_id, recipient_id, created_at DESC)
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_chat_recipient_sender_created_at
        ON chat (recipient_id, sender_id, created_at DESC)
      `);

      await db.query(`
        ALTER TABLE chat
        ADD COLUMN IF NOT EXISTS reply_to_message_id BIGINT NULL REFERENCES chat(id) ON DELETE SET NULL
      `);

      await db.query(`
        ALTER TABLE chat
        ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ NULL
      `);

      await db.query(`
        ALTER TABLE chat
        ADD COLUMN IF NOT EXISTS deleted_for_everyone_at TIMESTAMPTZ NULL
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS hidden_chat_messages (
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          message_id BIGINT NOT NULL REFERENCES chat(id) ON DELETE CASCADE,
          hidden_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id, message_id)
        )
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS hidden_conversations (
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          other_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          hidden_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id, other_user_id)
        )
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS pinned_conversations (
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          other_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          pinned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id, other_user_id)
        )
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS blocked_users (
          blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (blocker_id, blocked_id),
          CHECK (blocker_id <> blocked_id)
        )
      `);
    })().catch((err) => {
      ensureTablesPromise = null;
      throw err;
    });
  }

  return ensureTablesPromise;
};

exports.ensureChatTables = ensureChatTables;

const getTargetUser = async (targetUserId) => {
  const result = await db.query(
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

  return result.rows[0] || null;
};

const ensureTargetUserExists = async (targetUserId) => {
  const targetUser = await getTargetUser(targetUserId);
  if (!targetUser) {
    throw new Error('USER_NOT_FOUND');
  }
};

exports.listConversations = async ({ userId, search, limit, offset }) => {
  await ensureChatTables();

  const safeSearch = normalizeSearch(search);
  const safeLimit = normalizeLimit(limit);
  const safeOffset = normalizeOffset(offset);
  const likeSearch = `%${safeSearch}%`;

  const result = await db.query(
    `WITH following_users AS (
       SELECT
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
     ),
     chatted_users AS (
       SELECT
         u.id AS user_id,
         u.username,
         up.nome_exibicao,
         up.foto_perfil,
         NULL::TIMESTAMPTZ AS followed_at
       FROM (
         SELECT DISTINCT
           CASE
             WHEN dm.sender_id = $1 THEN dm.recipient_id
             ELSE dm.sender_id
           END AS other_user_id
         FROM chat dm
         WHERE dm.sender_id = $1
            OR dm.recipient_id = $1
       ) chat_contacts
       INNER JOIN users u ON u.id = chat_contacts.other_user_id
       LEFT JOIN users_profile up ON up.user_id = u.id
       WHERE
         $2 = ''
         OR u.username ILIKE $3
         OR COALESCE(up.nome_exibicao, '') ILIKE $3
     ),
     available_users AS (
       SELECT DISTINCT ON (base.user_id)
         base.user_id,
         base.username,
         base.nome_exibicao,
         base.foto_perfil,
         base.followed_at
       FROM (
         SELECT * FROM following_users
         UNION ALL
         SELECT * FROM chatted_users
       ) base
       ORDER BY base.user_id, base.followed_at DESC NULLS LAST
     )
     SELECT
       au.user_id,
       au.username,
       au.nome_exibicao,
       au.foto_perfil,
       lm.last_message,
       lm.last_message_at,
       COALESCE(unread.unread_count, 0)::INT AS unread_count,
       (lm.sender_id = $1) AS last_message_is_mine,
       (pin.other_user_id IS NOT NULL) AS is_pinned,
       pin.pinned_at,
       (blocked.blocked_id IS NOT NULL) AS is_blocked
     FROM available_users au
     LEFT JOIN hidden_conversations hidden
       ON hidden.user_id = $1
      AND hidden.other_user_id = au.user_id
     LEFT JOIN pinned_conversations pin
       ON pin.user_id = $1
      AND pin.other_user_id = au.user_id
     LEFT JOIN blocked_users blocked
       ON blocked.blocker_id = $1
      AND blocked.blocked_id = au.user_id
     LEFT JOIN LATERAL (
       SELECT
         CASE
           WHEN dm.deleted_for_everyone_at IS NOT NULL THEN 'Mensagem apagada'
           ELSE dm.content
         END AS last_message,
         dm.sender_id,
         dm.created_at AS last_message_at
       FROM chat dm
       WHERE
         (
           (dm.sender_id = $1 AND dm.recipient_id = au.user_id)
           OR
           (dm.sender_id = au.user_id AND dm.recipient_id = $1)
         )
         AND (
           blocked.blocked_id IS NULL
           OR dm.sender_id <> au.user_id
         )
         AND NOT EXISTS (
           SELECT 1
           FROM hidden_chat_messages hcm
           WHERE hcm.user_id = $1
             AND hcm.message_id = dm.id
         )
       ORDER BY dm.created_at DESC, dm.id DESC
       LIMIT 1
     ) lm ON TRUE
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::INT AS unread_count
       FROM chat dm
       WHERE dm.sender_id = au.user_id
         AND dm.recipient_id = $1
         AND dm.read_at IS NULL
     ) unread ON TRUE
     WHERE hidden.other_user_id IS NULL
        OR lm.last_message_at IS NULL
        OR lm.last_message_at > hidden.hidden_at
     ORDER BY
       (pin.other_user_id IS NOT NULL) DESC,
       pin.pinned_at ASC NULLS LAST,
       COALESCE(lm.last_message_at, au.followed_at) DESC,
       au.username ASC
     LIMIT $4 OFFSET $5`,
    [userId, safeSearch, likeSearch, safeLimit, safeOffset]
  );

  return result.rows;
};

exports.hideConversation = async ({ userId, targetUserId }) => {
  await ensureChatTables();

  if (String(userId) === String(targetUserId)) {
    throw new Error('INVALID_TARGET');
  }

  await ensureTargetUserExists(targetUserId);

  await db.query(
    `INSERT INTO hidden_conversations (user_id, other_user_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, other_user_id)
     DO UPDATE SET hidden_at = CURRENT_TIMESTAMP`,
    [userId, targetUserId]
  );

  await db.query(
    `DELETE FROM pinned_conversations
     WHERE user_id = $1
       AND other_user_id = $2`,
    [userId, targetUserId]
  );
};

exports.pinConversation = async ({ userId, targetUserId }) => {
  await ensureChatTables();

  if (String(userId) === String(targetUserId)) {
    throw new Error('INVALID_TARGET');
  }

  await ensureTargetUserExists(targetUserId);

  const pinnedCountResult = await db.query(
    `SELECT COUNT(*)::INT AS count
     FROM pinned_conversations
     WHERE user_id = $1`,
    [userId]
  );

  const alreadyPinnedResult = await db.query(
    `SELECT 1
     FROM pinned_conversations
     WHERE user_id = $1
       AND other_user_id = $2
     LIMIT 1`,
    [userId, targetUserId]
  );

  if (!alreadyPinnedResult.rows[0] && Number(pinnedCountResult.rows[0]?.count || 0) >= MAX_PINNED_CONVERSATIONS) {
    throw new Error('PIN_LIMIT_REACHED');
  }

  await db.query(
    `INSERT INTO pinned_conversations (user_id, other_user_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, other_user_id)
     DO UPDATE SET pinned_at = CURRENT_TIMESTAMP`,
    [userId, targetUserId]
  );
};

exports.unpinConversation = async ({ userId, targetUserId }) => {
  await ensureChatTables();

  await db.query(
    `DELETE FROM pinned_conversations
     WHERE user_id = $1
       AND other_user_id = $2`,
    [userId, targetUserId]
  );
};

exports.blockUser = async ({ userId, targetUserId }) => {
  await ensureChatTables();

  if (String(userId) === String(targetUserId)) {
    throw new Error('INVALID_TARGET');
  }

  await ensureTargetUserExists(targetUserId);

  await db.query(
    `INSERT INTO blocked_users (blocker_id, blocked_id)
     VALUES ($1, $2)
     ON CONFLICT (blocker_id, blocked_id)
     DO NOTHING`,
    [userId, targetUserId]
  );

  await db.query(
    `DELETE FROM pinned_conversations
     WHERE user_id = $1
       AND other_user_id = $2`,
    [userId, targetUserId]
  );
};

exports.unblockUser = async ({ userId, targetUserId }) => {
  await ensureChatTables();

  await db.query(
    `DELETE FROM blocked_users
     WHERE blocker_id = $1
       AND blocked_id = $2`,
    [userId, targetUserId]
  );
};
