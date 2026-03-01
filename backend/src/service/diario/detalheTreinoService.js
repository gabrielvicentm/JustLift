const db = require('../../utils/db');

exports.buscarDiasComTreinoPorUsuario = async ({ userId }) => {
  const query = `
    SELECT DISTINCT
      TO_CHAR(data, 'YYYY-MM-DD') AS data
    FROM treinos
    WHERE user_id = $1
    ORDER BY data ASC
  `;

  const result = await db.query(query, [userId]);
  return result.rows.map((row) => row.data);
};

exports.buscarDetalheTreinoPorData = async ({ userId, data, lang = 'pt' }) => {
  const safeLang = lang === 'en' ? 'en' : 'pt';

  const treinosQuery = `
    SELECT
      t.treino_id,
      TO_CHAR(t.data, 'YYYY-MM-DD') AS data,
      t.duracao,
      t.peso_total,
      t.total_series,
      t.finalizado
    FROM treinos t
    WHERE t.user_id = $1
      AND t.data = $2::date
    ORDER BY t.treino_id DESC
  `;

  const treinosResult = await db.query(treinosQuery, [userId, data]);
  const treinos = treinosResult.rows;

  if (treinos.length === 0) {
    return [];
  }

  const treinoIds = treinos.map((treino) => treino.treino_id);

  const detalhesQuery = `
    SELECT
      et.exercicio_treino_id,
      et.treino_id,
      et.exercise_id,
      et.custom_exercise_id,
      et.anotacoes,
      et.ordem,
      COALESCE(ec.nome, tr_lang.nome, tr_en.nome, et.exercise_id, 'Exercício') AS nome,
      COALESCE(ec.img_url, e.gif_url) AS imagem_url,
      s.serie_id,
      s.numero,
      s.kg,
      s.repeticoes,
      s.concluido
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
    LEFT JOIN series_do_exercicio s
      ON s.exercicio_treino_id = et.exercicio_treino_id
    WHERE et.treino_id = ANY($2::int[])
      AND t.user_id = $1
    ORDER BY et.treino_id DESC, et.ordem ASC, s.numero ASC
  `;

  const detalhesResult = await db.query(detalhesQuery, [userId, treinoIds, safeLang]);
  const rows = detalhesResult.rows;

  const treinosMap = new Map(
    treinos.map((treino) => [
      treino.treino_id,
      {
        ...treino,
        exercicios: [],
      },
    ]),
  );

  const exerciciosMap = new Map();

  rows.forEach((row) => {
    if (!treinosMap.has(row.treino_id)) {
      return;
    }

    const exercicioKey = `${row.treino_id}-${row.exercicio_treino_id}`;
    if (!exerciciosMap.has(exercicioKey)) {
      const exercicio = {
        exercicio_treino_id: row.exercicio_treino_id,
        source: row.custom_exercise_id ? 'custom' : 'api',
        exercise_id: row.exercise_id,
        custom_exercise_id: row.custom_exercise_id,
        nome: row.nome,
        imagem_url: row.imagem_url,
        anotacoes: row.anotacoes,
        ordem: row.ordem,
        series: [],
      };

      exerciciosMap.set(exercicioKey, exercicio);
      treinosMap.get(row.treino_id).exercicios.push(exercicio);
    }

    if (row.serie_id) {
      exerciciosMap.get(exercicioKey).series.push({
        serie_id: row.serie_id,
        numero: row.numero,
        kg: Number(row.kg),
        repeticoes: row.repeticoes,
        concluido: row.concluido,
      });
    }
  });

  return Array.from(treinosMap.values());
};
