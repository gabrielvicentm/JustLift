const db = require('../utils/db');

//isso vai sair ou mudar
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50; 

let ensureTablesPromise = null;

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
    })().catch((err) => {
      ensureTablesPromise = null;
      throw err;
    });
  }

  return ensureTablesPromise;
};

exports.ensureChatTables = ensureChatTables;

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
       (lm.sender_id = $1) AS last_message_is_mine
     FROM available_users au
     LEFT JOIN LATERAL (
       SELECT
         dm.content AS last_message,
         dm.sender_id,
         dm.created_at AS last_message_at
       FROM chat dm
       WHERE
         (dm.sender_id = $1 AND dm.recipient_id = au.user_id)
         OR
         (dm.sender_id = au.user_id AND dm.recipient_id = $1)
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
     ORDER BY COALESCE(lm.last_message_at, au.followed_at) DESC, au.username ASC
     LIMIT $4 OFFSET $5`,
    [userId, safeSearch, likeSearch, safeLimit, safeOffset]
  );

  return result.rows;
};
