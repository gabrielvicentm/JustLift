const db = require('../../utils/db');
const gamificacaoService = require('./gamificacaoService');

const SEARCH_EXERCISES_CACHE_TTL_MS = Number(process.env.SEARCH_EXERCISES_CACHE_TTL_MS || 60_000);
const SEARCH_EXERCISES_CACHE_MAX = Number(process.env.SEARCH_EXERCISES_CACHE_MAX || 200);
const searchExercisesCache = new Map();

const getCachedSearchExercises = (key) => {
  const cached = searchExercisesCache.get(key);
  if (!cached) {
    return null;
  }
  if (cached.expiresAt <= Date.now()) {
    searchExercisesCache.delete(key);
    return null;
  }
  return cached.value;
};

const setCachedSearchExercises = (key, value) => {
  if (searchExercisesCache.size >= SEARCH_EXERCISES_CACHE_MAX) {
    const oldestKey = searchExercisesCache.keys().next().value;
    if (oldestKey) {
      searchExercisesCache.delete(oldestKey);
    }
  }
  searchExercisesCache.set(key, { value, expiresAt: Date.now() + SEARCH_EXERCISES_CACHE_TTL_MS });
};

const buildSearchExercisesCacheKey = (params) =>
  JSON.stringify({
    q: params.query || '',
    lang: params.lang || 'pt',
    muscle: params.muscleKey || '',
    equipment: params.equipmentKey || '',
    limit: params.limit,
    offset: params.offset,
  });

// Cria um exercício customizado para o usuário autenticado.
// Entrada esperada:
// - userId: UUID do usuário dono do exercício.
// - nome, equipamento, musculoAlvo, imgUrl: metadados do exercício custom.
// Saída:
// - objeto da linha recém-criada.
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

  // Ordem dos valores segue a ordem dos placeholders $1..$5 da query.
  const values = [userId, nome, equipamento, musculoAlvo, imgUrl];
  // Executa o INSERT e retorna a linha criada.
  const result = await db.query(query, values);
  return result.rows[0];
};

// Busca exercícios canônicos com filtros opcionais e paginação.
// Fluxo:
// 1) Obtém base paginada via função SQL buscar_exercicios.
// 2) Enriquece resultado com listas de músculos/equipamentos traduzidos.
// 3) Retorna no mesmo formato esperado pela API.
exports.searchExercises = async ({
  query = null,
  lang = 'pt',
  muscleKey = null,
  equipmentKey = null,
  limit = 30,
  offset = 0,
}) => {
  const cacheKey = buildSearchExercisesCacheKey({ query, lang, muscleKey, equipmentKey, limit, offset });
  const cached = getCachedSearchExercises(cacheKey);
  if (cached) {
    return cached;
  }

  // CTE "base":
  // - centraliza o resultado da função SQL com ranking e filtros.
  // CTE "musculos" e "equipamentos":
  // - agregam labels por exercise_id apenas para a página atual (melhor custo).
  const sql = `
    WITH base AS (
      SELECT *
      FROM buscar_exercicios($1, $2, $3, $4, $5, $6)
    ),
    musculos AS (
      SELECT
        src.exercise_id,
        jsonb_agg(src.label ORDER BY src.label) AS musculos
      FROM (
        SELECT DISTINCT
          b.exercise_id,
          COALESCE(gmt_lang.label, gmt_en.label, egm.muscle_key) AS label
        FROM base b
        JOIN exercicio_grupos_musculares egm
          ON egm.exercise_id = b.exercise_id
        LEFT JOIN grupo_muscular_traducoes gmt_lang
          ON gmt_lang.muscle_key = egm.muscle_key
         AND gmt_lang.lang = $2
        LEFT JOIN grupo_muscular_traducoes gmt_en
          ON gmt_en.muscle_key = egm.muscle_key
         AND gmt_en.lang = 'en'
      ) src
      GROUP BY src.exercise_id
    ),
    equipamentos AS (
      SELECT
        src.exercise_id,
        jsonb_agg(src.label ORDER BY src.label) AS equipamentos
      FROM (
        SELECT DISTINCT
          b.exercise_id,
          COALESCE(et_lang.label, et_en.label, ee.equipment_key) AS label
        FROM base b
        JOIN exercicio_equipamentos ee
          ON ee.exercise_id = b.exercise_id
        LEFT JOIN equipamento_traducoes et_lang
          ON et_lang.equipment_key = ee.equipment_key
         AND et_lang.lang = $2
        LEFT JOIN equipamento_traducoes et_en
          ON et_en.equipment_key = ee.equipment_key
         AND et_en.lang = 'en'
      ) src
      GROUP BY src.exercise_id
    )
    SELECT
      b.exercise_id,
      b.nome_exibicao AS nome,
      b.nome_en,
      b.gif_url,
      b.score,
      COALESCE(m.musculos, '[]'::jsonb) AS musculos,
      COALESCE(eq.equipamentos, '[]'::jsonb) AS equipamentos
    FROM base b
    LEFT JOIN musculos m
      ON m.exercise_id = b.exercise_id
    LEFT JOIN equipamentos eq
      ON eq.exercise_id = b.exercise_id
    ORDER BY b.score DESC, b.nome_exibicao ASC
  `;

  // Parâmetros na mesma ordem dos placeholders da query.
  const values = [query, lang, muscleKey, equipmentKey, limit, offset];
  // Executa e devolve todas as linhas do resultado.
  const result = await db.query(sql, values);
  setCachedSearchExercises(cacheKey, result.rows);
  return result.rows;
};

// Lista os exercícios customizados de um usuário em ordem de criação (mais novo primeiro).
exports.getCustomExercisesByUser = async ({ userId, limit = 50, offset = 0 }) => {
  // Filtro por dono do exercício para isolamento entre usuários.
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
    LIMIT $2 OFFSET $3
  `;

  // Query simples sem transformação extra.
  const result = await db.query(query, [userId, limit, offset]);
  return result.rows;
};

// Busca, para cada exercício informado, as séries do último treino finalizado
// do usuário em que o exercício apareceu. Retorna os valores por número de série.
exports.getLastSeriesByExercises = async ({
  userId,
  apiExerciseIds = [],
  customExerciseIds = [],
}) => {
  const safeApiExerciseIds = Array.from(
    new Set(
      (Array.isArray(apiExerciseIds) ? apiExerciseIds : [])
        .map((id) => (typeof id === 'string' ? id.trim() : ''))
        .filter((id) => id.length > 0),
    ),
  );

  const safeCustomExerciseIds = Array.from(
    new Set(
      (Array.isArray(customExerciseIds) ? customExerciseIds : [])
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  );

  if (safeApiExerciseIds.length === 0 && safeCustomExerciseIds.length === 0) {
    return [];
  }

  const result = await db.query(
    `
      WITH requested AS (
        SELECT
          'api'::text AS source,
          api_id AS exercise_id,
          NULL::int AS custom_exercise_id
        FROM unnest($2::text[]) AS api_id
        UNION ALL
        SELECT
          'custom'::text AS source,
          NULL::text AS exercise_id,
          custom_id AS custom_exercise_id
        FROM unnest($3::int[]) AS custom_id
      ),
      latest_exercise_instance AS (
        SELECT
          r.source,
          r.exercise_id,
          r.custom_exercise_id,
          (
            SELECT edt.exercicio_treino_id
            FROM exercicios_do_treino edt
            JOIN treinos t
              ON t.treino_id = edt.treino_id
            WHERE
              t.user_id = $1
              AND t.finalizado = TRUE
              AND (
                (r.source = 'api' AND edt.exercise_id = r.exercise_id)
                OR (r.source = 'custom' AND edt.custom_exercise_id = r.custom_exercise_id)
              )
            ORDER BY t.data DESC, t.treino_id DESC, edt.ordem ASC
            LIMIT 1
          ) AS exercicio_treino_id
        FROM requested r
      )
      SELECT
        lei.source,
        lei.exercise_id,
        lei.custom_exercise_id,
        s.numero,
        s.kg,
        s.repeticoes
      FROM latest_exercise_instance lei
      JOIN series_do_exercicio s
        ON s.exercicio_treino_id = lei.exercicio_treino_id
      ORDER BY
        lei.source ASC,
        lei.exercise_id ASC NULLS LAST,
        lei.custom_exercise_id ASC NULLS LAST,
        s.numero ASC
    `,
    [userId, safeApiExerciseIds, safeCustomExerciseIds],
  );

  const grouped = result.rows.reduce((acc, row) => {
    const key = row.source === 'api'
      ? `api:${row.exercise_id}`
      : `custom:${row.custom_exercise_id}`;

    const current = acc.get(key) || {
      source: row.source,
      exercise_id: row.exercise_id ?? null,
      custom_exercise_id: row.custom_exercise_id != null ? Number(row.custom_exercise_id) : null,
      series: [],
    };

    current.series.push({
      numero: Number(row.numero),
      kg: row.kg != null ? Number(row.kg) : null,
      repeticoes: row.repeticoes != null ? Number(row.repeticoes) : null,
    });

    acc.set(key, current);
    return acc;
  }, new Map());

  return Array.from(grouped.values());
};

// Lista treinos finalizados do usuário para o fluxo de "repetir treino".
exports.getRecentWorkoutsForRepeat = async ({ userId, limit = 20 }) => {
  const safeLimit = Math.min(Math.max(Math.floor(Number(limit) || 20), 1), 50);

  const result = await db.query(
    `
      SELECT
        t.treino_id,
        TO_CHAR(t.data, 'YYYY-MM-DD') AS data,
        t.duracao,
        t.peso_total,
        t.total_series,
        COUNT(DISTINCT edt.exercicio_treino_id)::int AS total_exercicios
      FROM treinos t
      LEFT JOIN exercicios_do_treino edt
        ON edt.treino_id = t.treino_id
      WHERE t.user_id = $1
        AND t.finalizado = TRUE
      GROUP BY t.treino_id, t.data, t.duracao, t.peso_total, t.total_series
      ORDER BY t.data DESC, t.treino_id DESC
      LIMIT $2
    `,
    [userId, safeLimit],
  );

  return result.rows.map((row) => ({
    treino_id: Number(row.treino_id),
    data: row.data,
    duracao: row.duracao != null ? Number(row.duracao) : 0,
    peso_total: row.peso_total != null ? Number(row.peso_total) : 0,
    total_series: row.total_series != null ? Number(row.total_series) : 0,
    total_exercicios: Number(row.total_exercicios || 0),
  }));
};

// Retorna um template de treino para reutilização:
// exercícios + quantidade de séries por exercício.
exports.getWorkoutTemplateById = async ({ userId, treinoId, lang = 'pt' }) => {
  const safeLang = lang === 'en' ? 'en' : 'pt';

  const treinoResult = await db.query(
    `
      SELECT
        t.treino_id,
        TO_CHAR(t.data, 'YYYY-MM-DD') AS data
      FROM treinos t
      WHERE t.user_id = $1
        AND t.treino_id = $2
        AND t.finalizado = TRUE
      LIMIT 1
    `,
    [userId, treinoId],
  );

  if (treinoResult.rowCount === 0) {
    return null;
  }

  const exerciciosResult = await db.query(
    `
      SELECT
        et.exercicio_treino_id,
        et.exercise_id,
        et.custom_exercise_id,
        et.ordem,
        COALESCE(ec.nome, tr_lang.nome, tr_en.nome, et.exercise_id, 'Exercício') AS nome,
        tr_en.nome AS nome_en,
        COALESCE(ec.img_url, e.gif_url) AS gif_url,
        COUNT(s.serie_id)::int AS total_series
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
      WHERE t.user_id = $1
        AND t.treino_id = $2
      GROUP BY
        et.exercicio_treino_id,
        et.exercise_id,
        et.custom_exercise_id,
        et.ordem,
        ec.nome,
        ec.img_url,
        tr_lang.nome,
        tr_en.nome,
        e.gif_url
      ORDER BY et.ordem ASC, et.exercicio_treino_id ASC
    `,
    [userId, treinoId, safeLang],
  );

  return {
    treino_id: Number(treinoResult.rows[0].treino_id),
    data: treinoResult.rows[0].data,
    exercicios: exerciciosResult.rows.map((row) => ({
      source: row.custom_exercise_id ? 'custom' : 'api',
      exercise_id: row.exercise_id || null,
      custom_exercise_id: row.custom_exercise_id != null ? Number(row.custom_exercise_id) : null,
      nome: row.nome,
      nome_en: row.nome_en || null,
      gif_url: row.gif_url || null,
      total_series: Math.max(Number(row.total_series || 0), 1),
    })),
  };
};
 
// Persiste um treino completo (treino + exercícios + séries) de forma transacional.
// Regras importantes:
// - Tudo grava ou nada grava (BEGIN/COMMIT/ROLLBACK).
// - Calcula métricas agregadas no backend (peso_total e total_series concluídas).
// - Usa inserts em lote para reduzir round-trips com o banco.
exports.saveWorkout = async ({
  userId,
  data = null,
  duracao = 0,
  finalizado = true,
  exercicios = [],
}) => {
  // Conexão dedicada para transação explícita.
  const client = await db.connect();

  try {
    // Início da transação atômica.
    await client.query('BEGIN');

    // Soma quantas séries foram concluídas no treino.
    const totalSeries = exercicios.reduce((acc, ex) => (
      acc + ex.series.filter((serie) => serie.concluido).length
    ), 0);

    // Soma volume total (kg * repetições) apenas de séries concluídas.
    const pesoTotal = exercicios.reduce((acc, ex) => (
      acc + ex.series.reduce((inner, serie) => {
        if (!serie.concluido) return inner;
        return inner + (serie.kg * serie.repeticoes);
      }, 0)
    ), 0);

    // Cria o "cabeçalho" do treino.
    // Se data vier nula, usa CURRENT_DATE.
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

    // Persistência do treino principal.
    const treinoResult = await client.query(treinoInsertQuery, [
      userId,
      data,
      duracao,
      pesoTotal,
      totalSeries,
      finalizado,
    ]);

    // Linha criada em treinos (referência para filhos).
    const treino = treinoResult.rows[0];

    // Coleta IDs de exercícios customizados sem duplicar.
    const customIds = Array.from(new Set(
      exercicios
        .map((ex) => ex.custom_exercise_id)
        .filter((id) => Number.isInteger(id)),
    ));

    // Validação em lote de ownership de exercícios customizados:
    // todos os IDs enviados precisam pertencer ao usuário atual.
    if (customIds.length > 0) {
      const ownerCheck = await client.query(
        `
          SELECT id_exercicio_customizado
          FROM exercicios_customizados
          WHERE user_id = $1
            AND id_exercicio_customizado = ANY($2::int[])
        `,
        [userId, customIds],
      );

      // Conjunto dos IDs válidos retornados pelo banco.
      const ownedIds = new Set(ownerCheck.rows.map((row) => row.id_exercicio_customizado));
      // Se houver qualquer ID não pertencente ao usuário, aborta tudo.
      const invalidCustomId = customIds.find((id) => !ownedIds.has(id));
      if (invalidCustomId) {
        throw new Error(`Exercício customizado inválido para o usuário: ${invalidCustomId}`);
      }
    }

    // Monta INSERT em lote de exercicios_do_treino:
    // cada exercício gera 5 placeholders (treino_id, exercise_id, custom_exercise_id, anotacoes, ordem).
    const exercicioValues = [];
    const exercicioPlaceholders = exercicios.map((ex, idx) => {
      const base = idx * 5;
      exercicioValues.push(
        treino.treino_id,
        ex.exercise_id,
        ex.custom_exercise_id,
        ex.anotacoes,
        idx + 1,
      );
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
    });

    // Executa um único INSERT para todos os exercícios do treino.
    // Retorna id gerado + ordem para mapear com as séries depois.
    const exerciciosInsertResult = await client.query(
      `
        INSERT INTO exercicios_do_treino (
          treino_id,
          exercise_id,
          custom_exercise_id,
          anotacoes,
          ordem
        )
        VALUES ${exercicioPlaceholders.join(', ')}
        RETURNING exercicio_treino_id, ordem
      `,
      exercicioValues,
    );

    // Mapeia "ordem do payload" -> "exercicio_treino_id do banco".
    const exercicioTreinoIdByOrdem = new Map(
      exerciciosInsertResult.rows.map((row) => [row.ordem, row.exercicio_treino_id]),
    );

    // Normaliza todas as séries em uma única lista já com FK resolvida.
    const seriesRows = [];
    exercicios.forEach((ex, idx) => {
      const exercicioTreinoId = exercicioTreinoIdByOrdem.get(idx + 1);
      ex.series.forEach((serie, serieIdx) => {
        seriesRows.push({
          exercicioTreinoId,
          numero: serie.numero || (serieIdx + 1),
          kg: serie.kg,
          repeticoes: serie.repeticoes,
          concluido: serie.concluido,
        });
      });
    });

    // Se houver séries, persiste tudo em lote na tabela series_do_exercicio.
    if (seriesRows.length > 0) {
      const seriesValues = [];
      const seriesPlaceholders = seriesRows.map((serie, idx) => {
        // Cada série também gera 5 placeholders.
        const base = idx * 5;
        seriesValues.push(
          serie.exercicioTreinoId,
          serie.numero,
          serie.kg,
          serie.repeticoes,
          serie.concluido,
        );
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
      });

      await client.query(
        `
          INSERT INTO series_do_exercicio (
            exercicio_treino_id,
            numero,
            kg,
            repeticoes,
            concluido
          )
          VALUES ${seriesPlaceholders.join(', ')}
        `,
        seriesValues,
      );
    }

    await gamificacaoService.grantWorkoutPoints({
      userId,
      workoutId: treino.treino_id,
      volumeTotal: pesoTotal,
      finalizado,
      client,
    });

    // Finaliza transação com sucesso.
    await client.query('COMMIT');
    return treino;
  } catch (err) {
    // Em qualquer erro, desfaz tudo para não deixar dados parciais.
    await client.query('ROLLBACK');
    throw err;
  } finally {
    // Sempre libera a conexão de volta ao pool.
    client.release();
  }
};
