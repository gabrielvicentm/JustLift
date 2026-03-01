const db = require('../../utils/db');

const PERIOD_SQL_BY_KEY = {
  '7d': "CURRENT_DATE - INTERVAL '7 days'",
  '30d': "CURRENT_DATE - INTERVAL '30 days'",
  '1y': "CURRENT_DATE - INTERVAL '1 year'",
  all: null,
};

exports.getVolumeDistribution = async ({ userId, period = '7d' }) => {
  const dateFilterSql = PERIOD_SQL_BY_KEY[period] || PERIOD_SQL_BY_KEY['7d'];
  const dateWhere = dateFilterSql ? `AND t.data >= ${dateFilterSql}` : '';

  const distributionQuery = `
    WITH treinos_filtrados AS (
      SELECT
        t.treino_id,
        COALESCE(t.duracao, 0) AS duracao
      FROM treinos t
      WHERE t.user_id = $1
        AND t.finalizado = TRUE
        ${dateWhere}
    ),
    series_base AS (
      SELECT
        tf.treino_id,
        tf.duracao,
        edt.exercise_id,
        edt.custom_exercise_id
      FROM treinos_filtrados tf
      JOIN exercicios_do_treino edt
        ON edt.treino_id = tf.treino_id
      JOIN series_do_exercicio s
        ON s.exercicio_treino_id = edt.exercicio_treino_id
      WHERE s.concluido = TRUE
    ),
    distribuicao_api AS (
      SELECT
        COALESCE(gmt_pt.label, egm.muscle_key) AS musculo,
        COUNT(*)::int AS total_series
      FROM series_base sb
      JOIN exercicio_grupos_musculares egm
        ON egm.exercise_id = sb.exercise_id
      LEFT JOIN grupo_muscular_traducoes gmt_pt
        ON gmt_pt.muscle_key = egm.muscle_key
       AND gmt_pt.lang = 'pt'
      WHERE sb.exercise_id IS NOT NULL
      GROUP BY COALESCE(gmt_pt.label, egm.muscle_key)
    ),
    distribuicao_custom AS (
      SELECT
        COALESCE(NULLIF(TRIM(ec.musculo_alvo), ''), 'Outros') AS musculo,
        COUNT(*)::int AS total_series
      FROM series_base sb
      JOIN exercicios_customizados ec
        ON ec.id_exercicio_customizado = sb.custom_exercise_id
      WHERE sb.custom_exercise_id IS NOT NULL
      GROUP BY COALESCE(NULLIF(TRIM(ec.musculo_alvo), ''), 'Outros')
    ),
    distribuicao_completa AS (
      SELECT
        musculo,
        SUM(total_series)::int AS total_series
      FROM (
        SELECT * FROM distribuicao_api
        UNION ALL
        SELECT * FROM distribuicao_custom
      ) d
      GROUP BY musculo
    )
    SELECT dc.musculo, dc.total_series
    FROM distribuicao_completa dc
    ORDER BY dc.total_series DESC, dc.musculo ASC
  `;

  const totalsQuery = `
    SELECT
      COUNT(DISTINCT t.treino_id)::int AS total_treinos,
      COALESCE(SUM(t.duracao), 0)::int AS duracao_total_minutos
    FROM treinos t
    WHERE t.user_id = $1
      AND t.finalizado = TRUE
      ${dateWhere}
  `;

  const distributionResult = await db.query(distributionQuery, [userId]);
  const totalsResult = await db.query(totalsQuery, [userId]);
  const rows = distributionResult.rows || [];
  const totalsRow = totalsResult.rows[0] || {};

  const totalSeries = rows.reduce((acc, row) => acc + Number(row.total_series || 0), 0);
  const totalTreinos = Number(totalsRow.total_treinos || 0);
  const duracaoTotalMinutos = Number(totalsRow.duracao_total_minutos || 0);

  const distribution = rows.map((row) => {
    const series = Number(row.total_series || 0);
    const percentage = totalSeries > 0 ? (series / totalSeries) * 100 : 0;

    return {
      musculo: String(row.musculo || 'Outros'),
      total_series: series,
      percentual: Number(percentage.toFixed(1)),
    };
  });

  return {
    periodo: period,
    totais: {
      total_series: totalSeries,
      total_treinos: totalTreinos,
      duracao_total_minutos: duracaoTotalMinutos,
    },
    distribuicao: distribution,
  };
};

exports.getExercisesDone = async ({ userId, lang = 'pt' }) => {
  const safeLang = lang === 'en' ? 'en' : 'pt';

  const query = `
    WITH series_base AS (
      SELECT
        t.treino_id,
        t.data,
        edt.exercise_id,
        edt.custom_exercise_id,
        s.kg
      FROM treinos t
      JOIN exercicios_do_treino edt
        ON edt.treino_id = t.treino_id
      JOIN series_do_exercicio s
        ON s.exercicio_treino_id = edt.exercicio_treino_id
      WHERE t.user_id = $1
        AND t.finalizado = TRUE
        AND s.concluido = TRUE
    ),
    agrupado AS (
      SELECT
        'api'::text AS source,
        sb.exercise_id,
        NULL::int AS custom_exercise_id,
        COUNT(DISTINCT sb.treino_id)::int AS total_treinos,
        MAX(sb.kg)::numeric(10,2) AS recorde_kg,
        MAX(sb.data) AS ultima_data
      FROM series_base sb
      WHERE sb.exercise_id IS NOT NULL
      GROUP BY sb.exercise_id

      UNION ALL

      SELECT
        'custom'::text AS source,
        NULL::varchar(20) AS exercise_id,
        sb.custom_exercise_id,
        COUNT(DISTINCT sb.treino_id)::int AS total_treinos,
        MAX(sb.kg)::numeric(10,2) AS recorde_kg,
        MAX(sb.data) AS ultima_data
      FROM series_base sb
      WHERE sb.custom_exercise_id IS NOT NULL
      GROUP BY sb.custom_exercise_id
    )
    SELECT
      a.source,
      a.exercise_id,
      a.custom_exercise_id,
      COALESCE(ec.nome, tr_lang.nome, tr_en.nome, a.exercise_id, 'Exercício') AS nome,
      COALESCE(ec.img_url, e.gif_url) AS imagem_url,
      a.total_treinos,
      COALESCE(a.recorde_kg, 0)::float AS recorde_kg,
      TO_CHAR(a.ultima_data, 'YYYY-MM-DD') AS ultima_data
    FROM agrupado a
    LEFT JOIN exercicios_customizados ec
      ON ec.id_exercicio_customizado = a.custom_exercise_id
    LEFT JOIN exercicios e
      ON e.exercise_id = a.exercise_id
    LEFT JOIN exercicio_traducoes tr_lang
      ON tr_lang.exercise_id = a.exercise_id
     AND tr_lang.lang = $2
    LEFT JOIN exercicio_traducoes tr_en
      ON tr_en.exercise_id = a.exercise_id
     AND tr_en.lang = 'en'
    ORDER BY nome ASC
  `;

  const result = await db.query(query, [userId, safeLang]);
  return result.rows || [];
};

exports.getExerciseProgress = async ({
  userId,
  source,
  exerciseId = null,
  customExerciseId = null,
  lang = 'pt',
}) => {
  const safeLang = lang === 'en' ? 'en' : 'pt';
  const isApi = source === 'api';
  const idValue = isApi ? exerciseId : customExerciseId;
  const column = isApi ? 'edt.exercise_id' : 'edt.custom_exercise_id';

  const pointsQuery = `
    SELECT
      t.treino_id,
      TO_CHAR(t.data, 'YYYY-MM-DD') AS data,
      MAX(s.kg)::float AS peso_maximo
    FROM treinos t
    JOIN exercicios_do_treino edt
      ON edt.treino_id = t.treino_id
    JOIN series_do_exercicio s
      ON s.exercicio_treino_id = edt.exercicio_treino_id
    WHERE t.user_id = $1
      AND t.finalizado = TRUE
      AND s.concluido = TRUE
      AND ${column} = $2
    GROUP BY t.treino_id, t.data
    ORDER BY t.data ASC, t.treino_id ASC
  `;

  const pointsResult = await db.query(pointsQuery, [userId, idValue]);
  const pontos = pointsResult.rows || [];

  let exercicio = null;

  if (isApi) {
    const nameResult = await db.query(
      `
        SELECT COALESCE(tr_lang.nome, tr_en.nome, $1::text, 'Exercício') AS nome
        FROM exercicios e
        LEFT JOIN exercicio_traducoes tr_lang
          ON tr_lang.exercise_id = e.exercise_id
         AND tr_lang.lang = $2
        LEFT JOIN exercicio_traducoes tr_en
          ON tr_en.exercise_id = e.exercise_id
         AND tr_en.lang = 'en'
        WHERE e.exercise_id = $1
        LIMIT 1
      `,
      [exerciseId, safeLang],
    );

    exercicio = {
      source: 'api',
      exercise_id: exerciseId,
      custom_exercise_id: null,
      nome: String(nameResult.rows?.[0]?.nome || exerciseId || 'Exercício'),
    };
  } else {
    const nameResult = await db.query(
      `
        SELECT COALESCE(ec.nome, 'Exercício customizado') AS nome
        FROM exercicios_customizados ec
        WHERE ec.id_exercicio_customizado = $1
        LIMIT 1
      `,
      [customExerciseId],
    );

    exercicio = {
      source: 'custom',
      exercise_id: null,
      custom_exercise_id: customExerciseId,
      nome: String(nameResult.rows?.[0]?.nome || `Exercício #${customExerciseId}`),
    };
  }

  const first = pontos[0] ? Number(pontos[0].peso_maximo || 0) : 0;
  const last = pontos.length > 0 ? Number(pontos[pontos.length - 1].peso_maximo || 0) : 0;
  const delta = last - first;
  const variacaoPercentual = first > 0 ? (delta / first) * 100 : 0;
  const recordeKg = pontos.reduce((acc, p) => Math.max(acc, Number(p.peso_maximo || 0)), 0);

  return {
    exercicio,
    pontos: pontos.map((p) => ({
      treino_id: Number(p.treino_id),
      data: p.data,
      peso_maximo: Number(p.peso_maximo || 0),
    })),
    estatisticas: {
      total_treinos: pontos.length,
      recorde_kg: Number(recordeKg.toFixed(2)),
      peso_inicial_kg: Number(first.toFixed(2)),
      peso_final_kg: Number(last.toFixed(2)),
      variacao_kg: Number(delta.toFixed(2)),
      variacao_percentual: Number(variacaoPercentual.toFixed(1)),
    },
  };
};
