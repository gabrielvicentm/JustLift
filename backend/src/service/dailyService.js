const db = require('../utils/db');

const ACTIVE_DAILY_WINDOW_SQL = "CURRENT_TIMESTAMP - INTERVAL '24 hours'";
const MAX_DAILY_BATCH = 20;

async function dailyExists(dailyId) {
  const exists = await db.query('SELECT 1 FROM daily WHERE daily_id = $1 LIMIT 1', [dailyId]);
  return exists.rows.length > 0;
}

function normalizeDailyRow(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    username: row.username,
    nome_exibicao: row.nome_exibicao,
    foto_perfil: row.foto_perfil,
    media_type: row.media_type,
    media_url: row.media_url,
    media_key: row.media_key,
    duration_seconds: row.duration_seconds,
    created_at: row.created_at,
    likes_count: row.likes_count,
    viewer_liked: row.viewer_liked,
    viewer_viewed: row.viewer_viewed,
  };
}

exports.createDailyBatch = async ({ userId, midias }) => {
  const client = await db.connect();

  try {
    if (midias.length > MAX_DAILY_BATCH) {
      throw new Error('DAILY_BATCH_TOO_LARGE');
    }

    //se tudo der certo → salva
    // se der erro → desfaz tudo
    await client.query('BEGIN');

    const mediaTypes = midias.map((item) => item.type);
    const mediaUrls = midias.map((item) => item.url);
    const mediaKeys = midias.map((item) => item.key);
    const durations = midias.map((item) => item.duration_seconds || null);

    const batchResult = await client.query(
      `
        WITH payload AS (
          SELECT
            *
          FROM unnest(
            $2::text[],
            $3::text[],
            $4::text[],
            $5::int[]
          ) WITH ORDINALITY
          AS t(media_type, media_url, media_key, duration_seconds, ord)
        )
        INSERT INTO daily (
          user_id,
          media_type,
          media_url,
          media_key,
          duration_seconds
        )
        SELECT
          $1,
          media_type,
          media_url,
          media_key,
          duration_seconds
        FROM payload
        ORDER BY ord
        RETURNING daily_id
      `,
      [userId, mediaTypes, mediaUrls, mediaKeys, durations],
    );

    const createdRows = batchResult.rows.map((row) => row.daily_id);

    await client.query('COMMIT');

    const response = await db.query(
      `
        SELECT
          d.daily_id AS id,
          d.user_id,
          u.username,
          up.nome_exibicao,
          up.foto_perfil,
          d.media_type,
          d.media_url,
          d.media_key,
          d.duration_seconds,
          d.created_at,
          0::INT AS likes_count,
          false AS viewer_liked,
          false AS viewer_viewed
        FROM daily d
        JOIN users u ON u.id = d.user_id
        LEFT JOIN users_profile up ON up.user_id = d.user_id
        WHERE d.daily_id = ANY($1::int[])
        ORDER BY d.created_at ASC, d.daily_id ASC
      `,
      [createdRows],
    );

    return response.rows.map(normalizeDailyRow);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.getActiveDailyByUser = async ({ userId, viewerUserId }) => {
  const result = await db.query(
    `
      WITH base AS (
        SELECT
          d.daily_id,
          d.user_id,
          d.media_type,
          d.media_url,
          d.media_key,
          d.duration_seconds,
          d.created_at
        FROM daily d
        WHERE d.user_id = $1
          AND d.created_at >= ${ACTIVE_DAILY_WINDOW_SQL}
      ),
      likes AS (
        SELECT daily_id, COUNT(*)::INT AS likes_count
        FROM daily_likes
        WHERE daily_id = ANY(SELECT daily_id FROM base)
        GROUP BY daily_id
      ),
      viewer_likes AS (
        SELECT daily_id
        FROM daily_likes
        WHERE user_id = $2
          AND daily_id = ANY(SELECT daily_id FROM base)
      ),
      viewer_views AS (
        SELECT daily_id
        FROM daily_views
        WHERE user_id = $2
          AND daily_id = ANY(SELECT daily_id FROM base)
      )
      SELECT
        b.daily_id AS id,
        b.user_id,
        u.username,
        up.nome_exibicao,
        up.foto_perfil,
        b.media_type,
        b.media_url,
        b.media_key,
        b.duration_seconds,
        b.created_at,
        COALESCE(l.likes_count, 0) AS likes_count,
        EXISTS (
          SELECT 1 FROM viewer_likes vl WHERE vl.daily_id = b.daily_id
        ) AS viewer_liked,
        EXISTS (
          SELECT 1 FROM viewer_views vv WHERE vv.daily_id = b.daily_id
        ) AS viewer_viewed
      FROM base b
      JOIN users u ON u.id = b.user_id
      LEFT JOIN users_profile up ON up.user_id = b.user_id
      LEFT JOIN likes l ON l.daily_id = b.daily_id
      ORDER BY b.created_at ASC, b.daily_id ASC
    `,
    [userId, viewerUserId],
  );

  return result.rows.map(normalizeDailyRow);
};

exports.getDailySummaryByUser = async ({ userId, viewerUserId }) => {
  const result = await db.query(
    `
      SELECT
        COUNT(*)::INT AS total_active,
        COUNT(*) FILTER (
          WHERE NOT EXISTS (
            SELECT 1
            FROM daily_views v
            WHERE v.daily_id = d.daily_id
              AND v.user_id = $2
          )
        )::INT AS unseen_count
      FROM daily d
      WHERE d.user_id = $1
        AND d.created_at >= ${ACTIVE_DAILY_WINDOW_SQL}
    `,
    [userId, viewerUserId],
  );

  const totalActive = result.rows[0]?.total_active || 0; //quantidade de daily
  const unseenCount = result.rows[0]?.unseen_count || 0; //quantidade de daily que o usuario ainda nao viu

  return {
    total_active: totalActive,
    unseen_count: unseenCount,
    has_active_daily: totalActive > 0,
    has_unseen_daily: unseenCount > 0,
  };
};

exports.toggleLike = async ({ dailyId, userId }) => {
  if (!(await dailyExists(dailyId))) {
    return null;
  }

  const deleted = await db.query(
    `
      DELETE FROM daily_likes
      WHERE daily_id = $1
        AND user_id = $2
      RETURNING daily_id
    `,
    [dailyId, userId],
  );

  let liked = false;
  if (deleted.rows.length === 0) {
    await db.query(
      `
        INSERT INTO daily_likes (daily_id, user_id)
        VALUES ($1, $2)
      `,
      [dailyId, userId],
    );
    liked = true;
  }

  const likesCount = await db.query(
    `
      SELECT COUNT(*)::INT AS likes_count
      FROM daily_likes
      WHERE daily_id = $1
    `,
    [dailyId],
  );

  return {
    liked,
    likes_count: likesCount.rows[0].likes_count,
  };
};

exports.markViewed = async ({ dailyId, userId }) => {
  if (!(await dailyExists(dailyId))) {
    return null;
  }

  await db.query(
    `
      INSERT INTO daily_views (daily_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (daily_id, user_id) DO NOTHING
    `,
    [dailyId, userId],
  );

  return { viewed: true };
};

exports.deleteDaily = async ({ dailyId, userId }) => {
  const deleted = await db.query(
    `
      DELETE FROM daily
      WHERE daily_id = $1
        AND user_id = $2
      RETURNING daily_id
    `,
    [dailyId, userId],
  );

  return deleted.rowCount > 0;
};
