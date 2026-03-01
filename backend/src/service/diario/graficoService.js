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
