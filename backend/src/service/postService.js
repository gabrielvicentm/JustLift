const db = require('../utils/db');

async function postExists(postId) {
  const exists = await db.query('SELECT 1 FROM posts WHERE post_id = $1 LIMIT 1', [postId]);
  return exists.rows.length > 0;
}

async function getMediaByPostId(postId) {
  const result = await db.query(
    `
      SELECT
        photo_id AS id,
        media_type AS type,
        media_url AS url,
        media_key AS key,
        ordem AS media_order
      FROM post_photos
      WHERE post_id = $1
      ORDER BY ordem ASC, photo_id ASC
    `,
    [postId],
  );
  return result.rows;
}

async function getCommentsByPostId(postId) {
  const result = await db.query(
    `
      SELECT
        c.id,
        c.user_id,
        u.username,
        up.nome_exibicao,
        up.foto_perfil,
        c.comentario,
        c.created_at
      FROM post_comments c
      JOIN users u ON u.id = c.user_id
      LEFT JOIN users_profile up ON up.user_id = u.id
      WHERE c.post_id = $1
      ORDER BY c.created_at DESC, c.id DESC
      LIMIT 100
    `,
    [postId],
  );
  return result.rows;
}

function mapPostSummaryRow(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    username: row.username,
    nome_exibicao: row.nome_exibicao,
    foto_perfil: row.foto_perfil,
    descricao: row.descricao,
    created_at: row.created_at,
    likes_count: row.likes_count,
    saves_count: row.saves_count,
    comments_count: row.comments_count,
    viewer_liked: row.viewer_liked,
    viewer_saved: row.viewer_saved,
    tipo: row.tipo || 'normal',
    treino: row.treino_id
      ? {
          treino_id: row.treino_id,
          data: row.treino_data,
          duracao: row.treino_duracao,
          peso_total: row.treino_peso_total,
          total_series: row.treino_total_series,
          total_exercicios: row.treino_total_exercicios,
          finalizado: row.treino_finalizado,
        }
      : null,
  };
}

async function getPostSummaryById(postId, viewerUserId) {
  const result = await db.query(
    `
      SELECT
        p.post_id AS id,
        p.user_id,
        u.username,
        up.nome_exibicao,
        up.foto_perfil,
        p.descricao,
        p.tipo,
        p.treino_id,
        t.data AS treino_data,
        t.duracao AS treino_duracao,
        t.peso_total AS treino_peso_total,
        t.total_series AS treino_total_series,
        t.finalizado AS treino_finalizado,
        CASE
          WHEN p.treino_id IS NULL THEN NULL
          ELSE (
            SELECT COUNT(*)
            FROM exercicios_do_treino et
            WHERE et.treino_id = p.treino_id
          )::INT
        END AS treino_total_exercicios,
        p.created_at,
        (
          SELECT COUNT(*)
          FROM post_likes l
          WHERE l.post_id = p.post_id
        )::INT AS likes_count,
        (
          SELECT COUNT(*)
          FROM post_saves s
          WHERE s.post_id = p.post_id
        )::INT AS saves_count,
        (
          SELECT COUNT(*)
          FROM post_comments c
          WHERE c.post_id = p.post_id
        )::INT AS comments_count,
        EXISTS (
          SELECT 1
          FROM post_likes vl
          WHERE vl.post_id = p.post_id
            AND vl.user_id = $2
        ) AS viewer_liked,
        EXISTS (
          SELECT 1
          FROM post_saves vs
          WHERE vs.post_id = p.post_id
            AND vs.user_id = $2
        ) AS viewer_saved
      FROM posts p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN users_profile up ON up.user_id = u.id
      LEFT JOIN treinos t ON t.treino_id = p.treino_id
      WHERE p.post_id = $1
      LIMIT 1
    `,
    [postId, viewerUserId],
  );

  return result.rows[0] ? mapPostSummaryRow(result.rows[0]) : null;
}

function mergePostWithMedia(post, midias) {
  return {
    ...post,
    midias,
  };
}

exports.createPost = async ({ userId, descricao, midias }) => {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const createdPost = await client.query(
      `
        INSERT INTO posts (
          user_id,
          descricao
        )
        VALUES ($1, $2)
        RETURNING post_id
      `,
      [userId, descricao],
    );

    const postId = createdPost.rows[0].post_id;

    if (midias.length > 0) {
      const values = [];
      const placeholders = midias.map((item, index) => {
        const base = index * 5;
        values.push(postId, item.type, item.url, item.key, index + 1);
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
      });

      await client.query(
        `
          INSERT INTO post_photos (
            post_id,
            media_type,
            media_url,
            media_key,
            ordem
          )
          VALUES ${placeholders.join(', ')}
        `,
        values,
      );
    }

    await client.query('COMMIT');

    const summary = await getPostSummaryById(postId, userId);
    const medias = await getMediaByPostId(postId);

    return mergePostWithMedia(summary, medias);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.getPostsByUser = async ({ userId, viewerUserId }) => {
  const result = await db.query(
    `
      SELECT
        p.post_id AS id,
        p.user_id,
        u.username,
        up.nome_exibicao,
        up.foto_perfil,
        p.descricao,
        p.tipo,
        p.treino_id,
        t.data AS treino_data,
        t.duracao AS treino_duracao,
        t.peso_total AS treino_peso_total,
        t.total_series AS treino_total_series,
        t.finalizado AS treino_finalizado,
        CASE
          WHEN p.treino_id IS NULL THEN NULL
          ELSE (
            SELECT COUNT(*)
            FROM exercicios_do_treino et
            WHERE et.treino_id = p.treino_id
          )::INT
        END AS treino_total_exercicios,
        p.created_at,
        (
          SELECT COUNT(*)
          FROM post_likes l
          WHERE l.post_id = p.post_id
        )::INT AS likes_count,
        (
          SELECT COUNT(*)
          FROM post_saves s
          WHERE s.post_id = p.post_id
        )::INT AS saves_count,
        (
          SELECT COUNT(*)
          FROM post_comments c
          WHERE c.post_id = p.post_id
        )::INT AS comments_count,
        EXISTS (
          SELECT 1
          FROM post_likes vl
          WHERE vl.post_id = p.post_id
            AND vl.user_id = $2
        ) AS viewer_liked,
        EXISTS (
          SELECT 1
          FROM post_saves vs
          WHERE vs.post_id = p.post_id
            AND vs.user_id = $2
        ) AS viewer_saved
      FROM posts p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN users_profile up ON up.user_id = u.id
      LEFT JOIN treinos t ON t.treino_id = p.treino_id
      WHERE p.user_id = $1
      ORDER BY p.created_at DESC, p.post_id DESC
    `,
    [userId, viewerUserId],
  );

  const posts = result.rows.map(mapPostSummaryRow);
  if (posts.length === 0) {
    return [];
  }

  const postIds = posts.map((post) => post.id);
  const mediaRows = await db.query(
    `
      SELECT
        photo_id AS id,
        post_id,
        media_type AS type,
        media_url AS url,
        media_key AS key,
        ordem AS media_order
      FROM post_photos
      WHERE post_id = ANY($1::bigint[])
      ORDER BY ordem ASC, photo_id ASC
    `,
    [postIds],
  );

  const mediaMap = new Map();
  for (const row of mediaRows.rows) {
    const current = mediaMap.get(row.post_id) || [];
    current.push({
      id: row.id,
      type: row.type,
      url: row.url,
      key: row.key,
      media_order: row.media_order,
    });
    mediaMap.set(row.post_id, current);
  }

  return posts.map((post) => ({
    ...post,
    midias: mediaMap.get(post.id) || [],
  }));
};

exports.getPostById = async ({ postId, viewerUserId }) => {
  const summary = await getPostSummaryById(postId, viewerUserId);
  if (!summary) {
    return null;
  }

  const [midias, comentarios] = await Promise.all([
    getMediaByPostId(postId),
    getCommentsByPostId(postId),
  ]);

  return {
    ...summary,
    midias,
    comentarios,
  };
};

exports.updatePost = async ({ postId, userId, descricao, midias = [], replaceMidias = false }) => {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const ownerCheck = await client.query(
      `
        SELECT post_id
        FROM posts
        WHERE post_id = $1
          AND user_id = $2
        LIMIT 1
      `,
      [postId, userId],
    );

    if (ownerCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    if (replaceMidias) {
      await client.query(
        `
          DELETE FROM post_photos
          WHERE post_id = $1
        `,
        [postId],
      );

      if (midias.length > 0) {
        const values = [];
        const placeholders = midias.map((item, index) => {
          const base = index * 5;
          values.push(postId, item.type, item.url, item.key, index + 1);
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
        });

        await client.query(
          `
            INSERT INTO post_photos (
              post_id,
              media_type,
              media_url,
              media_key,
              ordem
            )
            VALUES ${placeholders.join(', ')}
          `,
          values,
        );
      }
    }

    let mediaCount = 0;
    if (replaceMidias) {
      mediaCount = midias.length;
    } else {
      const mediaCountResult = await client.query(
        `
          SELECT COUNT(*)::INT AS total
          FROM post_photos
          WHERE post_id = $1
        `,
        [postId],
      );
      mediaCount = mediaCountResult.rows[0]?.total || 0;
    }

    if (!descricao && mediaCount === 0) {
      await client.query('ROLLBACK');
      throw new Error('POST_EMPTY');
    }

    await client.query(
      `
        UPDATE posts
        SET
          descricao = $1
        WHERE post_id = $2
          AND user_id = $3
      `,
      [descricao || '', postId, userId],
    );

    await client.query('COMMIT');

    const summary = await getPostSummaryById(postId, userId);
    const updatedMidias = await getMediaByPostId(postId);
    return mergePostWithMedia(summary, updatedMidias);
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // noop
    }
    throw err;
  } finally {
    client.release();
  }
};

exports.deletePost = async ({ postId, userId }) => {
  const deleted = await db.query(
    `
      DELETE FROM posts
      WHERE post_id = $1
        AND user_id = $2
      RETURNING post_id
    `,
    [postId, userId],
  );

  return deleted.rows.length > 0;
};

exports.toggleLike = async ({ postId, userId }) => {
  if (!(await postExists(postId))) {
    return null;
  }

  const deleted = await db.query(
    `
      DELETE FROM post_likes
      WHERE post_id = $1
        AND user_id = $2
      RETURNING post_id
    `,
    [postId, userId],
  );

  let liked = false;
  if (deleted.rows.length === 0) {
    await db.query(
      `
        INSERT INTO post_likes (post_id, user_id)
        VALUES ($1, $2)
      `,
      [postId, userId],
    );
    liked = true;
  }

  const likesCount = await db.query(
    `
      SELECT COUNT(*)::INT AS likes_count
      FROM post_likes
      WHERE post_id = $1
    `,
    [postId],
  );

  return {
    liked,
    likes_count: likesCount.rows[0].likes_count,
  };
};

exports.toggleSave = async ({ postId, userId }) => {
  if (!(await postExists(postId))) {
    return null;
  }

  const deleted = await db.query(
    `
      DELETE FROM post_saves
      WHERE post_id = $1
        AND user_id = $2
      RETURNING post_id
    `,
    [postId, userId],
  );

  let saved = false;
  if (deleted.rows.length === 0) {
    await db.query(
      `
        INSERT INTO post_saves (post_id, user_id)
        VALUES ($1, $2)
      `,
      [postId, userId],
    );
    saved = true;
  }

  return { saved };
};

exports.reportPost = async ({ postId, userId, reason }) => {
  if (!(await postExists(postId))) {
    return null;
  }

  await db.query(
    `
      INSERT INTO post_reports (
        post_id,
        user_id,
        reason
      )
      VALUES ($1, $2, $3)
      ON CONFLICT (post_id, user_id)
      DO UPDATE SET
        reason = EXCLUDED.reason,
        created_at = CURRENT_TIMESTAMP
    `,
    [postId, userId, reason],
  );

  return { ok: true };
};

exports.createComment = async ({ postId, userId, comentario }) => {
  if (!(await postExists(postId))) {
    return null;
  }

  const result = await db.query(
    `
      INSERT INTO post_comments (
        post_id,
        user_id,
        comentario
      )
      VALUES ($1, $2, $3)
      RETURNING
        id,
        post_id,
        user_id,
        comentario,
        created_at
    `,
    [postId, userId, comentario],
  );

  const comment = result.rows[0];
  const author = await db.query(
    `
      SELECT
        u.username,
        up.nome_exibicao,
        up.foto_perfil
      FROM users u
      LEFT JOIN users_profile up ON up.user_id = u.id
      WHERE u.id = $1
      LIMIT 1
    `,
    [userId],
  );

  return {
    ...comment,
    username: author.rows[0]?.username || null,
    nome_exibicao: author.rows[0]?.nome_exibicao || null,
    foto_perfil: author.rows[0]?.foto_perfil || null,
  };
};
