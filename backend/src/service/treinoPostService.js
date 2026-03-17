const db = require('../utils/db');
const postService = require('./postService');

function normalizeLang(lang) {
  return lang === 'en' ? 'en' : 'pt';
}

exports.getTreinoResumoById = async ({ userId, treinoId, lang }) => {
  const treinoResult = await db.query(
    `
      SELECT
        t.treino_id,
        TO_CHAR(t.data, 'YYYY-MM-DD') AS data,
        t.duracao,
        t.peso_total,
        t.total_series,
        t.finalizado
      FROM treinos t
      WHERE t.treino_id = $1
        AND t.user_id = $2
      LIMIT 1
    `,
    [treinoId, userId],
  );

  if (treinoResult.rows.length === 0) {
    return null;
  }

  const safeLang = normalizeLang(lang);

  const exerciciosResult = await db.query(
    `
      SELECT
        et.exercicio_treino_id,
        COALESCE(ec.nome, tr_lang.nome, tr_en.nome, et.exercise_id, 'Exercicio') AS nome,
        COALESCE(ec.img_url, e.gif_url) AS imagem_url
      FROM exercicios_do_treino et
      INNER JOIN treinos t
        ON t.treino_id = et.treino_id
      LEFT JOIN exercicios_customizados ec
        ON ec.id_exercicio_customizado = et.custom_exercise_id
      LEFT JOIN exercicios e
        ON e.exercise_id = et.exercise_id
      LEFT JOIN exercicio_traducoes tr_lang
        ON tr_lang.exercise_id = et.exercise_id
       AND tr_lang.lang = $3
      LEFT JOIN exercicio_traducoes tr_en
        ON tr_en.exercise_id = et.exercise_id
       AND tr_en.lang = 'en'
      WHERE et.treino_id = $1
        AND t.user_id = $2
      ORDER BY et.ordem ASC
    `,
    [treinoId, userId, safeLang],
  );

  const exercicios = exerciciosResult.rows.map((row) => ({
    exercicio_treino_id: row.exercicio_treino_id,
    nome: row.nome,
    imagem_url: row.imagem_url,
  }));

  return {
    ...treinoResult.rows[0],
    total_exercicios: exercicios.length,
    exercicios,
  };
};

exports.createTreinoPost = async ({ userId, treinoId, descricao, midias }) => {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const treinoCheck = await client.query(
      `
        SELECT treino_id
        FROM treinos
        WHERE treino_id = $1
          AND user_id = $2
        LIMIT 1
      `,
      [treinoId, userId],
    );

    if (treinoCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const createdPost = await client.query(
      `
        INSERT INTO posts (
          user_id,
          descricao,
          tipo,
          treino_id
        )
        VALUES ($1, $2, 'treino', $3)
        RETURNING post_id
      `,
      [userId, descricao, treinoId],
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

    const postDetail = await postService.getPostById({ postId, viewerUserId: userId });
    return postDetail;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
