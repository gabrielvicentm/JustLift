const db = require('../../utils/db');

exports.createCustomExercise = async ({ userId, nome, equipamento, musculoAlvo, imgUrl }) => {
  const query = `
    INSERT INTO exercicios_customizados (
      user_id,
      nome,
      equipamento,
      musculo_alvo,
      img_url
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING
      id_exercicio_customizado,
      user_id,
      nome,
      equipamento,
      musculo_alvo,
      img_url,
      created_at
  `;

  const values = [userId, nome, equipamento, musculoAlvo, imgUrl];
  const result = await db.query(query, values);
  return result.rows[0];
};

exports.searchExercises = async ({
  query = null,
  lang = 'pt',
  muscleKey = null,
  equipmentKey = null,
  limit = 30,
  offset = 0,
}) => {
  const sql = `
    SELECT
      b.exercise_id,
      b.nome_exibicao AS nome,
      b.nome_en,
      b.gif_url,
      b.score,
      COALESCE(m.musculos, '[]'::jsonb) AS musculos,
      COALESCE(eq.equipamentos, '[]'::jsonb) AS equipamentos
    FROM buscar_exercicios($1, $2, $3, $4, $5, $6) b
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(x.label ORDER BY x.label) AS musculos
      FROM (
        SELECT DISTINCT COALESCE(gmt_lang.label, gmt_en.label, egm.muscle_key) AS label
        FROM exercicio_grupos_musculares egm
        LEFT JOIN grupo_muscular_traducoes gmt_lang
          ON gmt_lang.muscle_key = egm.muscle_key
         AND gmt_lang.lang = $2
        LEFT JOIN grupo_muscular_traducoes gmt_en
          ON gmt_en.muscle_key = egm.muscle_key
         AND gmt_en.lang = 'en'
        WHERE egm.exercise_id = b.exercise_id
      ) x
    ) m ON TRUE
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(x.label ORDER BY x.label) AS equipamentos
      FROM (
        SELECT DISTINCT COALESCE(et_lang.label, et_en.label, ee.equipment_key) AS label
        FROM exercicio_equipamentos ee
        LEFT JOIN equipamento_traducoes et_lang
          ON et_lang.equipment_key = ee.equipment_key
         AND et_lang.lang = $2
        LEFT JOIN equipamento_traducoes et_en
          ON et_en.equipment_key = ee.equipment_key
         AND et_en.lang = 'en'
        WHERE ee.exercise_id = b.exercise_id
      ) x
    ) eq ON TRUE
    ORDER BY b.score DESC, b.nome_exibicao ASC
  `;

  const values = [query, lang, muscleKey, equipmentKey, limit, offset];
  const result = await db.query(sql, values);
  return result.rows;
};

exports.getCustomExercisesByUser = async ({ userId }) => {
  const query = `
    SELECT
      id_exercicio_customizado,
      user_id,
      nome,
      equipamento,
      musculo_alvo,
      img_url,
      created_at
    FROM exercicios_customizados
    WHERE user_id = $1
    ORDER BY created_at DESC
  `;

  const result = await db.query(query, [userId]);
  return result.rows;
};
 
exports.saveWorkout = async ({
  userId,
  data = null,
  duracao = 0,
  finalizado = true,
  exercicios = [],
}) => {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const totalSeries = exercicios.reduce((acc, ex) => (
      acc + ex.series.filter((serie) => serie.concluido).length
    ), 0);

    const pesoTotal = exercicios.reduce((acc, ex) => (
      acc + ex.series.reduce((inner, serie) => {
        if (!serie.concluido) return inner;
        return inner + (serie.kg * serie.repeticoes);
      }, 0)
    ), 0);

    const treinoInsertQuery = `
      INSERT INTO treinos (
        user_id,
        data,
        duracao,
        peso_total,
        total_series,
        finalizado
      )
      VALUES (
        $1,
        COALESCE($2::date, CURRENT_DATE),
        $3,
        $4,
        $5,
        $6
      )
      RETURNING treino_id, user_id, data, duracao, peso_total, total_series, finalizado
    `;

    const treinoResult = await client.query(treinoInsertQuery, [
      userId,
      data,
      duracao,
      pesoTotal,
      totalSeries,
      finalizado,
    ]);

    const treino = treinoResult.rows[0];

    for (let idx = 0; idx < exercicios.length; idx += 1) {
      const ex = exercicios[idx];

      if (ex.custom_exercise_id) {
        const ownerCheck = await client.query(
          `SELECT 1 FROM exercicios_customizados WHERE id_exercicio_customizado = $1 AND user_id = $2`,
          [ex.custom_exercise_id, userId],
        );

        if (ownerCheck.rowCount === 0) {
          throw new Error(`Exercício customizado inválido para o usuário: ${ex.custom_exercise_id}`);
        }
      }

      const exercicioTreinoInsertQuery = `
        INSERT INTO exercicios_do_treino (
          treino_id,
          exercise_id,
          custom_exercise_id,
          anotacoes,
          ordem
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING exercicio_treino_id
      `;

      const exercicioTreinoResult = await client.query(exercicioTreinoInsertQuery, [
        treino.treino_id,
        ex.exercise_id,
        ex.custom_exercise_id,
        ex.anotacoes,
        idx + 1,
      ]);

      const exercicioTreinoId = exercicioTreinoResult.rows[0].exercicio_treino_id;

      for (let serieIdx = 0; serieIdx < ex.series.length; serieIdx += 1) {
        const serie = ex.series[serieIdx];

        await client.query(
          `
            INSERT INTO series_do_exercicio (
              exercicio_treino_id,
              numero,
              kg,
              repeticoes,
              concluido
            )
            VALUES ($1, $2, $3, $4, $5)
          `,
          [
            exercicioTreinoId,
            serie.numero || (serieIdx + 1),
            serie.kg,
            serie.repeticoes,
            serie.concluido,
          ],
        );
      }
    }

    await client.query('COMMIT');
    return treino;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
