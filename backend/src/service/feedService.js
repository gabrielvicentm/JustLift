const db = require('../utils/db');

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

async function fetchFeedPosts({ userId, limit, offset, mode }) {
  if (limit <= 0) {
    return [];
  }

  const isFollowing = mode === 'following';
  const baseJoin = isFollowing
    ? `JOIN user_follows uf
        ON uf.following_id = p.user_id
       AND uf.follower_id = $1`
    : `LEFT JOIN user_follows uf
        ON uf.following_id = p.user_id
       AND uf.follower_id = $1`;

  const baseWhere = isFollowing
    ? 'WHERE p.oculto = FALSE'
    : 'WHERE p.oculto = FALSE AND p.user_id <> $1 AND uf.following_id IS NULL';

  const result = await db.query(
    `
      WITH base AS (
        SELECT
          p.post_id,
          p.user_id,
          p.descricao,
          p.tipo,
          p.treino_id,
          p.created_at
        FROM posts p
        ${baseJoin}
        ${baseWhere}
        ORDER BY p.created_at DESC, p.post_id DESC
        LIMIT $2 OFFSET $3
      ),
      treino_counts AS (
        SELECT
          et.treino_id,
          COUNT(*)::INT AS treino_total_exercicios
        FROM exercicios_do_treino et
        WHERE et.treino_id = ANY(
          SELECT treino_id
          FROM base
          WHERE treino_id IS NOT NULL
        )
        GROUP BY et.treino_id
      ),
      likes AS (
        SELECT post_id, COUNT(*)::INT AS likes_count
        FROM post_likes
        WHERE post_id = ANY(SELECT post_id FROM base)
        GROUP BY post_id
      ),
      saves AS (
        SELECT post_id, COUNT(*)::INT AS saves_count
        FROM post_saves
        WHERE post_id = ANY(SELECT post_id FROM base)
        GROUP BY post_id
      ),
      comments AS (
        SELECT post_id, COUNT(*)::INT AS comments_count
        FROM post_comments
        WHERE post_id = ANY(SELECT post_id FROM base)
        GROUP BY post_id
      ),
      viewer_likes AS (
        SELECT post_id
        FROM post_likes
        WHERE user_id = $1
          AND post_id = ANY(SELECT post_id FROM base)
      ),
      viewer_saves AS (
        SELECT post_id
        FROM post_saves
        WHERE user_id = $1
          AND post_id = ANY(SELECT post_id FROM base)
      )
      SELECT
        b.post_id AS id,
        b.user_id,
        u.username,
        up.nome_exibicao,
        up.foto_perfil,
        b.descricao,
        b.tipo,
        b.treino_id,
        t.data AS treino_data,
        t.duracao AS treino_duracao,
        t.peso_total AS treino_peso_total,
        t.total_series AS treino_total_series,
        t.finalizado AS treino_finalizado,
        CASE
          WHEN b.treino_id IS NULL THEN NULL
          ELSE COALESCE(tc.treino_total_exercicios, 0)
        END AS treino_total_exercicios,
        b.created_at,
        COALESCE(l.likes_count, 0) AS likes_count,
        COALESCE(s.saves_count, 0) AS saves_count,
        COALESCE(c.comments_count, 0) AS comments_count,
        EXISTS (
          SELECT 1
          FROM viewer_likes vl
          WHERE vl.post_id = b.post_id
        ) AS viewer_liked,
        EXISTS (
          SELECT 1
          FROM viewer_saves vs
          WHERE vs.post_id = b.post_id
        ) AS viewer_saved
      FROM base b
      JOIN users u ON u.id = b.user_id
      LEFT JOIN users_profile up ON up.user_id = u.id
      LEFT JOIN treinos t ON t.treino_id = b.treino_id
      LEFT JOIN treino_counts tc ON tc.treino_id = b.treino_id
      LEFT JOIN likes l ON l.post_id = b.post_id
      LEFT JOIN saves s ON s.post_id = b.post_id
      LEFT JOIN comments c ON c.post_id = b.post_id
      ORDER BY b.created_at DESC, b.post_id DESC
    `,
    [userId, limit, offset],
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
}

function mixPosts(primaryPosts, secondaryPosts, primaryWeight) {
  const total = primaryPosts.length + secondaryPosts.length;
  if (total === 0) {
    return [];
  }

  const result = [];
  let p = 0;
  let s = 0;

  while (result.length < total) {
    const targetPrimary = Math.round((result.length + 1) * primaryWeight);
    if (p < primaryPosts.length && p < targetPrimary) {
      result.push(primaryPosts[p++]);
      continue;
    }
    if (s < secondaryPosts.length) {
      result.push(secondaryPosts[s++]);
      continue;
    }
    if (p < primaryPosts.length) {
      result.push(primaryPosts[p++]);
    }
  }

  return result;
}

async function getFollowingCount(userId) {
  const result = await db.query(
    `
      SELECT COUNT(*)::INT AS total
      FROM user_follows
      WHERE follower_id = $1
    `,
    [userId],
  );

  return result.rows[0]?.total || 0;
}

async function getSuggestedUsers({ userId, limit = 10 }) {
  if (limit <= 0) {
    return [];
  }

  const result = await db.query(
    `
      SELECT
        u.id AS user_id,
        u.username,
        up.nome_exibicao,
        up.foto_perfil,
        COALESCE(f.followers_count, 0) AS followers_count,
        COALESCE(p.posts_count, 0) AS posts_count
      FROM users u
      LEFT JOIN users_profile up ON up.user_id = u.id
      LEFT JOIN (
        SELECT following_id, COUNT(*)::INT AS followers_count
        FROM user_follows
        GROUP BY following_id
      ) f ON f.following_id = u.id
      LEFT JOIN (
        SELECT user_id, COUNT(*)::INT AS posts_count
        FROM posts
        WHERE oculto = FALSE
        GROUP BY user_id
      ) p ON p.user_id = u.id
      LEFT JOIN user_follows me
        ON me.follower_id = $1
       AND me.following_id = u.id
      WHERE u.id <> $1
        AND me.following_id IS NULL
      ORDER BY
        COALESCE(f.followers_count, 0) DESC,
        COALESCE(p.posts_count, 0) DESC,
        u.created_at DESC
      LIMIT $2
    `,
    [userId, limit],
  );

  return result.rows;
}

async function getHomeFeed({ userId, limit = 20, offset = 0 }) {
  const followingCount = await getFollowingCount(userId);
  const followWeight = 0.6;

  if (followingCount === 0) {
    const posts = await fetchFeedPosts({
      userId,
      limit,
      offset,
      mode: 'discovery',
    });
    const suggestedUsers = await getSuggestedUsers({ userId, limit: 10 });

    return {
      posts,
      suggested_users: suggestedUsers,
      meta: {
        limit,
        offset,
        count: posts.length,
        source_mix: { following: 0, discovery: posts.length },
        has_following: false,
      },
    };
  }

  const followLimit = Math.max(0, Math.floor(limit * followWeight));
  const discoveryLimit = Math.max(0, limit - followLimit);

  const followOffset = Math.floor(offset * followWeight);
  const discoveryOffset = Math.floor(offset * (1 - followWeight));

  const followPosts = await fetchFeedPosts({
    userId,
    limit: followLimit,
    offset: followOffset,
    mode: 'following',
  });

  let discoveryPosts = await fetchFeedPosts({
    userId,
    limit: discoveryLimit,
    offset: discoveryOffset,
    mode: 'discovery',
  });

  if (followPosts.length < followLimit) {
    const extra = followLimit - followPosts.length;
    if (extra > 0) {
      const extraPosts = await fetchFeedPosts({
        userId,
        limit: extra,
        offset: discoveryOffset + discoveryLimit,
        mode: 'discovery',
      });
      discoveryPosts = discoveryPosts.concat(extraPosts);
    }
  }

  if (discoveryPosts.length < discoveryLimit) {
    const extra = discoveryLimit - discoveryPosts.length;
    if (extra > 0) {
      const extraPosts = await fetchFeedPosts({
        userId,
        limit: extra,
        offset: followOffset + followLimit,
        mode: 'following',
      });
      followPosts.push(...extraPosts);
    }
  }

  const posts = mixPosts(followPosts, discoveryPosts, followWeight).slice(0, limit);

  return {
    posts,
    meta: {
      limit,
      offset,
      count: posts.length,
      source_mix: { following: followPosts.length, discovery: discoveryPosts.length },
      has_following: true,
    },
  };
}

async function getExploreFeed({ userId, limit = 30, offset = 0 }) {
  const followWeight = 0.1;
  const followLimit = Math.max(0, Math.floor(limit * followWeight));
  const discoveryLimit = Math.max(0, limit - followLimit);

  const followOffset = Math.floor(offset * followWeight);
  const discoveryOffset = Math.floor(offset * (1 - followWeight));

  let discoveryPosts = await fetchFeedPosts({
    userId,
    limit: discoveryLimit,
    offset: discoveryOffset,
    mode: 'discovery',
  });

  const followPosts = await fetchFeedPosts({
    userId,
    limit: followLimit,
    offset: followOffset,
    mode: 'following',
  });

  if (discoveryPosts.length < discoveryLimit) {
    const extra = discoveryLimit - discoveryPosts.length;
    if (extra > 0) {
      const extraPosts = await fetchFeedPosts({
        userId,
        limit: extra,
        offset: followOffset + followLimit,
        mode: 'following',
      });
      followPosts.push(...extraPosts);
    }
  }

  if (followPosts.length < followLimit) {
    const extra = followLimit - followPosts.length;
    if (extra > 0) {
      const extraPosts = await fetchFeedPosts({
        userId,
        limit: extra,
        offset: discoveryOffset + discoveryLimit,
        mode: 'discovery',
      });
      discoveryPosts = discoveryPosts.concat(extraPosts);
    }
  }

  const posts = mixPosts(discoveryPosts, followPosts, 1 - followWeight).slice(0, limit);

  return {
    posts,
    meta: {
      limit,
      offset,
      count: posts.length,
      source_mix: { following: followPosts.length, discovery: discoveryPosts.length },
    },
  };
}

module.exports = {
  getHomeFeed,
  getExploreFeed,
  getSuggestedUsers,
};
