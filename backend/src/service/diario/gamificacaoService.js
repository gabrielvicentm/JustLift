const db = require('../../utils/db');

const WORKOUT_SOURCE_TYPE = 'workout_save';
const MAX_WORKOUT_POINTS = 300;
const MAX_WORKOUT_POINTS_PREMIUM = 600;
const SEASON_DURATION_MONTHS = 6;
const SEASON_ANCHOR_START_ISO = '2026-01-01T00:00:00.000Z';
const SEASON_LOCK_KEY = 987654321;

const PATENTES = [
  { minPoints: 0, key: 'ferro', label: 'Ferro' },
  { minPoints: 1200, key: 'bronze', label: 'Bronze' },
  { minPoints: 3000, key: 'prata', label: 'Prata' },
  { minPoints: 6000, key: 'ouro', label: 'Ouro' },
  { minPoints: 10000, key: 'safira', label: 'Safira' },
  { minPoints: 15000, key: 'rubi', label: 'Rubi' },
  { minPoints: 19000, key: 'esmeralda', label: 'Esmeralda' },
  { minPoints: 23400, key: 'diamante', label: 'Diamante' },
];

const addMonthsUtc = (date, months) => {
  const next = new Date(date.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
};

const getSeasonWindowByNumber = (seasonNumber) => {
  const normalizedSeasonNumber = Math.max(Math.floor(Number(seasonNumber) || 1), 1);
  const anchor = new Date(SEASON_ANCHOR_START_ISO);
  const startsAt = addMonthsUtc(anchor, (normalizedSeasonNumber - 1) * SEASON_DURATION_MONTHS);
  const endsAt = addMonthsUtc(startsAt, SEASON_DURATION_MONTHS);

  return {
    seasonNumber: normalizedSeasonNumber,
    startsAt,
    endsAt,
  };
};

const getSeasonWindowForDate = (dateInput) => {
  const now = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const anchor = new Date(SEASON_ANCHOR_START_ISO);

  if (now < anchor) {
    return {
      seasonNumber: 1,
      startsAt: anchor,
      endsAt: addMonthsUtc(anchor, SEASON_DURATION_MONTHS),
    };
  }

  let seasonNumber = 1;
  let startsAt = anchor;
  let endsAt = addMonthsUtc(startsAt, SEASON_DURATION_MONTHS);

  while (now >= endsAt) {
    seasonNumber += 1;
    startsAt = endsAt;
    endsAt = addMonthsUtc(startsAt, SEASON_DURATION_MONTHS);
  }

  return { seasonNumber, startsAt, endsAt };
};

const toSeasonPayload = (seasonRow, now) => {
  const startsAt = new Date(seasonRow.starts_at);
  const endsAt = new Date(seasonRow.ends_at);
  const remainingMs = Math.max(endsAt.getTime() - now.getTime(), 0);

  return {
    temporadaId: Number(seasonRow.temporada_id),
    seasonNumber: Number(seasonRow.season_number),
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    remainingMs,
    remainingSeconds: Math.floor(remainingMs / 1000),
  };
};

const getPatenteByPoints = (points) => {
  const safePoints = Number.isFinite(Number(points)) ? Number(points) : 0;
  const patente = PATENTES.reduce((acc, current) => (
    safePoints >= current.minPoints ? current : acc
  ), PATENTES[0]);

  return {
    ...patente,
    pointsToNext: null,
    nextPatente: null,
  };
};

const enrichPatenteProgress = (totalPoints) => {
  const patente = getPatenteByPoints(totalPoints);
  const idx = PATENTES.findIndex((p) => p.key === patente.key);
  const nextPatente = idx >= 0 && idx < (PATENTES.length - 1) ? PATENTES[idx + 1] : null;

  if (!nextPatente) {
    return {
      ...patente,
      pointsToNext: 0,
      nextPatente: null,
    };
  }

  return {
    ...patente,
    pointsToNext: Math.max(nextPatente.minPoints - Number(totalPoints || 0), 0),
    nextPatente: {
      key: nextPatente.key,
      label: nextPatente.label,
      minPoints: nextPatente.minPoints,
    },
  };
};

const getPatentesRoadmap = (totalPoints) => {
  const safePoints = Number.isFinite(Number(totalPoints)) ? Number(totalPoints) : 0;
  const currentPatente = getPatenteByPoints(safePoints);

  return PATENTES.map((patente, index) => {
    const next = index < PATENTES.length - 1 ? PATENTES[index + 1] : null;
    return {
      ...patente,
      pointsToNextFromHere: next ? Math.max(next.minPoints - safePoints, 0) : 0,
      pointsRemaining: Math.max(patente.minPoints - safePoints, 0),
      reached: safePoints >= patente.minPoints,
      isCurrent: patente.key === currentPatente.key,
    };
  });
};

const getClient = async (providedClient) => {
  if (providedClient) {
    return { client: providedClient, shouldRelease: false };
  }

  const client = await db.connect();
  return { client, shouldRelease: true };
};

const computeWorkoutPoints = (volumeTotal, { isPremium = false } = {}) => {
  const safeVolume = Number.isFinite(Number(volumeTotal)) ? Number(volumeTotal) : 0;
  const rawPoints = Math.floor(safeVolume / 100);
  const multiplier = isPremium ? 2 : 1;
  const maxPoints = isPremium ? MAX_WORKOUT_POINTS_PREMIUM : MAX_WORKOUT_POINTS;
  return Math.max(0, Math.min(rawPoints * multiplier, maxPoints));
};

const getIsPremium = async ({ userId, client } = {}) => {
  const result = client
    ? await client.query('SELECT is_premium FROM users WHERE id = $1', [userId])
    : await db.query('SELECT is_premium FROM users WHERE id = $1', [userId]);
  return Boolean(result.rows[0]?.is_premium);
};

const getTotalPoints = async ({ userId, client }) => {
  const result = await client.query(
    `
      SELECT COALESCE(gs.pontos_totais, 0) AS pontos_totais
      FROM users u
      LEFT JOIN gamificacao_saldos gs
        ON gs.user_id = u.id
      WHERE u.id = $1
    `,
    [userId],
  );

  return Number(result.rows[0]?.pontos_totais || 0);
};

const getGlobalPosition = async ({ userId, client }) => {
  const result = await client.query(
    `
      WITH ranking_base AS (
        SELECT
          u.id,
          COALESCE(gs.pontos_totais, 0) AS total_points,
          u.created_at
        FROM users u
        LEFT JOIN gamificacao_saldos gs
          ON gs.user_id = u.id
      ),
      target AS (
        SELECT id, total_points, created_at
        FROM ranking_base
        WHERE id = $1
      )
      SELECT
        1 + COUNT(*)::INT AS posicao
      FROM ranking_base rb
      CROSS JOIN target t
      WHERE
        rb.total_points > t.total_points
        OR (
          rb.total_points = t.total_points
          AND (
            rb.created_at < t.created_at
            OR (rb.created_at = t.created_at AND rb.id < t.id)
          )
        )
    `,
    [userId],
  );

  return Number(result.rows[0]?.posicao || 0);
};

const finalizeSeason = async ({ client, seasonRow, now }) => {
  await client.query(
    `
      INSERT INTO gamificacao_resultados_temporada (
        temporada_id,
        user_id,
        username_snapshot,
        foto_perfil_snapshot,
        pontos_totais,
        posicao
      )
      SELECT
        $1,
        ranking.user_id,
        ranking.username,
        ranking.foto_perfil,
        ranking.total_points,
        ranking.posicao
      FROM (
        SELECT
          u.id AS user_id,
          u.username,
          up.foto_perfil,
          COALESCE(gs.pontos_totais, 0) AS total_points,
          ROW_NUMBER() OVER (
            ORDER BY COALESCE(gs.pontos_totais, 0) DESC, u.created_at ASC, u.id ASC
          ) AS posicao
        FROM users u
        LEFT JOIN gamificacao_saldos gs
          ON gs.user_id = u.id
        LEFT JOIN users_profile up
          ON up.user_id = u.id
      ) ranking
      WHERE ranking.total_points > 0
      ON CONFLICT (temporada_id, user_id) DO UPDATE
      SET
        username_snapshot = EXCLUDED.username_snapshot,
        foto_perfil_snapshot = EXCLUDED.foto_perfil_snapshot,
        pontos_totais = EXCLUDED.pontos_totais,
        posicao = EXCLUDED.posicao
    `,
    [seasonRow.temporada_id],
  );

  await client.query(
    `
      UPDATE gamificacao_temporadas
      SET
        status = 'finished',
        finalized_at = $2
      WHERE temporada_id = $1
    `,
    [seasonRow.temporada_id, now],
  );

  await client.query('DELETE FROM gamificacao_saldos');
  await client.query('DELETE FROM gamificacao_eventos');
};

const ensureCurrentSeason = async ({ client }) => {
  await client.query('SELECT pg_advisory_xact_lock($1)', [SEASON_LOCK_KEY]);

  const nowResult = await client.query('SELECT CURRENT_TIMESTAMP AS now');
  const now = new Date(nowResult.rows[0].now);

  while (true) {
    const expiredSeasonResult = await client.query(
      `
        SELECT temporada_id, season_number, starts_at, ends_at
        FROM gamificacao_temporadas
        WHERE status = 'active'
          AND ends_at <= $1
        ORDER BY season_number ASC
        LIMIT 1
        FOR UPDATE
      `,
      [now],
    );

    if (expiredSeasonResult.rowCount === 0) {
      break;
    }

    const expiredSeason = expiredSeasonResult.rows[0];
    await finalizeSeason({ client, seasonRow: expiredSeason, now });

    const nextWindow = getSeasonWindowByNumber(Number(expiredSeason.season_number) + 1);
    await client.query(
      `
        INSERT INTO gamificacao_temporadas (season_number, starts_at, ends_at, status)
        VALUES ($1, $2, $3, 'active')
        ON CONFLICT (season_number) DO NOTHING
      `,
      [nextWindow.seasonNumber, nextWindow.startsAt, nextWindow.endsAt],
    );
  }

  const expectedWindow = getSeasonWindowForDate(now);

  await client.query(
    `
      INSERT INTO gamificacao_temporadas (season_number, starts_at, ends_at, status)
      VALUES ($1, $2, $3, 'active')
      ON CONFLICT (season_number)
      DO UPDATE SET
        starts_at = EXCLUDED.starts_at,
        ends_at = EXCLUDED.ends_at
    `,
    [expectedWindow.seasonNumber, expectedWindow.startsAt, expectedWindow.endsAt],
  );

  const currentSeasonResult = await client.query(
    `
      SELECT temporada_id, season_number, starts_at, ends_at
      FROM gamificacao_temporadas
      WHERE season_number = $1
      LIMIT 1
    `,
    [expectedWindow.seasonNumber],
  );

  return {
    season: toSeasonPayload(currentSeasonResult.rows[0], now),
    now,
  };
};

exports.grantPoints = async ({
  userId,
  points,
  sourceType,
  sourceId = null,
  metadata = null,
  client: providedClient = null,
}) => {
  const safePoints = Number.isFinite(Number(points)) ? Math.max(Math.floor(Number(points)), 0) : 0;
  const { client, shouldRelease } = await getClient(providedClient);

  try {
    if (!providedClient) {
      await client.query('BEGIN');
    }

    const { season } = await ensureCurrentSeason({ client });

    if (safePoints === 0) {
      const totalPoints = await getTotalPoints({ userId, client });
      if (!providedClient) await client.query('COMMIT');
      return {
        awarded: false,
        pointsAwarded: 0,
        totalPoints,
        season,
        patente: enrichPatenteProgress(totalPoints),
      };
    }

    const eventInsert = await client.query(
      `
        INSERT INTO gamificacao_eventos (
          user_id,
          source_type,
          source_id,
          points,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id, source_type, source_id)
        WHERE source_id IS NOT NULL
        DO NOTHING
        RETURNING evento_id
      `,
      [userId, sourceType, sourceId, safePoints, metadata],
    );

    if (sourceId && eventInsert.rowCount === 0) {
      const totalPoints = await getTotalPoints({ userId, client });
      if (!providedClient) await client.query('COMMIT');
      return {
        awarded: false,
        pointsAwarded: 0,
        totalPoints,
        season,
        patente: enrichPatenteProgress(totalPoints),
      };
    }

    const saldoResult = await client.query(
      `
        INSERT INTO gamificacao_saldos (user_id, pontos_totais)
        VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE
        SET
          pontos_totais = gamificacao_saldos.pontos_totais + EXCLUDED.pontos_totais,
          updated_at = CURRENT_TIMESTAMP
        RETURNING pontos_totais
      `,
      [userId, safePoints],
    );

    const totalPoints = Number(saldoResult.rows[0]?.pontos_totais || 0);

    if (!providedClient) {
      await client.query('COMMIT');
    }

    return {
      awarded: true,
      pointsAwarded: safePoints,
      totalPoints,
      season,
      patente: enrichPatenteProgress(totalPoints),
    };
  } catch (err) {
    if (!providedClient) {
      await client.query('ROLLBACK');
    }
    throw err;
  } finally {
    if (shouldRelease) {
      client.release();
    }
  }
};

exports.grantWorkoutPoints = async ({
  userId,
  workoutId,
  volumeTotal,
  finalizado = true,
  client = null,
}) => {
  if (!finalizado) {
    const { client: resolvedClient, shouldRelease } = await getClient(client);
    try {
      if (!client) {
        await resolvedClient.query('BEGIN');
      }
      const { season } = await ensureCurrentSeason({ client: resolvedClient });
      const totalPoints = await getTotalPoints({ userId, client: resolvedClient });
      if (!client) {
        await resolvedClient.query('COMMIT');
      }
      return {
        awarded: false,
        pointsAwarded: 0,
        totalPoints,
        season,
        patente: enrichPatenteProgress(totalPoints),
      };
    } catch (err) {
      if (!client) {
        await resolvedClient.query('ROLLBACK');
      }
      throw err;
    } finally {
      if (shouldRelease) resolvedClient.release();
    }
  }

  const isPremium = await getIsPremium({ userId });
  const points = computeWorkoutPoints(volumeTotal, { isPremium });
  return exports.grantPoints({
    userId,
    points,
    sourceType: WORKOUT_SOURCE_TYPE,
    sourceId: workoutId ? String(workoutId) : null,
    metadata: {
      rule: isPremium ? 'volume_total_div_100_x2_capped_600' : 'volume_total_div_100_capped_300',
      volume_total: Number.isFinite(Number(volumeTotal)) ? Number(volumeTotal) : 0,
      is_premium: isPremium,
    },
    client,
  });
};

exports.getMyGamificacao = async ({ userId }) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { season } = await ensureCurrentSeason({ client });
    const totalPoints = await getTotalPoints({ userId, client });
    const globalPosition = await getGlobalPosition({ userId, client });
    await client.query('COMMIT');
    return {
      totalPoints,
      global_position: globalPosition,
      season,
      patente: enrichPatenteProgress(totalPoints),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.getMyGamificacaoPatentes = async ({ userId }) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { season } = await ensureCurrentSeason({ client });
    const totalPoints = await getTotalPoints({ userId, client });
    const globalPosition = await getGlobalPosition({ userId, client });
    const isPremium = await getIsPremium({ userId, client });
    await client.query('COMMIT');

    return {
      totalPoints,
      global_position: globalPosition,
      season,
      patente: enrichPatenteProgress(totalPoints),
      patentes: getPatentesRoadmap(totalPoints),
      maxPointsPerWorkout: isPremium ? MAX_WORKOUT_POINTS_PREMIUM : MAX_WORKOUT_POINTS,
      seasonDurationMonths: SEASON_DURATION_MONTHS,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.getMyGamificacaoHistorico = async ({ userId, limit = 30, offset = 0 }) => {
  const safeLimit = Math.min(Math.max(Math.floor(Number(limit) || 30), 1), 100);
  const safeOffset = Math.max(Math.floor(Number(offset) || 0), 0);

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await ensureCurrentSeason({ client });
    const result = await client.query(
      `
        SELECT
          evento_id,
          source_type,
          source_id,
          points,
          metadata,
          created_at
        FROM gamificacao_eventos
        WHERE user_id = $1
        ORDER BY created_at DESC, evento_id DESC
        LIMIT $2
        OFFSET $3
      `,
      [userId, safeLimit, safeOffset],
    );
    await client.query('COMMIT');

    return {
      eventos: result.rows,
      meta: {
        limit: safeLimit,
        offset: safeOffset,
        count: result.rows.length,
      },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.getMySeasonHistory = async ({ userId, limit = 10, offset = 0 }) => {
  const safeLimit = Math.min(Math.max(Math.floor(Number(limit) || 10), 1), 50);
  const safeOffset = Math.max(Math.floor(Number(offset) || 0), 0);

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await ensureCurrentSeason({ client });

    const seasonRowsResult = await client.query(
      `
        SELECT
          t.temporada_id,
          t.season_number,
          t.starts_at,
          t.ends_at,
          my.posicao AS my_position,
          my.pontos_totais AS my_points
        FROM gamificacao_temporadas t
        LEFT JOIN gamificacao_resultados_temporada my
          ON my.temporada_id = t.temporada_id
         AND my.user_id = $1
        WHERE t.status = 'finished'
        ORDER BY t.season_number DESC
        LIMIT $2
        OFFSET $3
      `,
      [userId, safeLimit, safeOffset],
    );

    const seasonIds = seasonRowsResult.rows.map((row) => Number(row.temporada_id));

    let topResultsBySeason = new Map();

    if (seasonIds.length > 0) {
      const topResults = await client.query(
        `
          SELECT
            ranked.temporada_id,
            ranked.posicao,
            ranked.username_snapshot,
            ranked.foto_perfil_snapshot,
            ranked.pontos_totais
          FROM (
            SELECT
              r.*,
              ROW_NUMBER() OVER (
                PARTITION BY r.temporada_id
                ORDER BY r.posicao ASC
              ) AS row_in_season
            FROM gamificacao_resultados_temporada r
            WHERE r.temporada_id = ANY($1::bigint[])
          ) ranked
          WHERE ranked.row_in_season <= 3
          ORDER BY ranked.temporada_id DESC, ranked.posicao ASC
        `,
        [seasonIds],
      );

      topResultsBySeason = topResults.rows.reduce((acc, row) => {
        const seasonId = Number(row.temporada_id);
        const current = acc.get(seasonId) || [];
        current.push({
          posicao: Number(row.posicao),
          username: row.username_snapshot,
          foto_perfil: row.foto_perfil_snapshot,
          total_points: Number(row.pontos_totais || 0),
        });
        acc.set(seasonId, current);
        return acc;
      }, new Map());
    }

    await client.query('COMMIT');

    return {
      temporadas: seasonRowsResult.rows.map((row) => ({
        temporadaId: Number(row.temporada_id),
        seasonNumber: Number(row.season_number),
        startsAt: new Date(row.starts_at).toISOString(),
        endsAt: new Date(row.ends_at).toISOString(),
        myPosition: row.my_position ? Number(row.my_position) : null,
        myPoints: row.my_points ? Number(row.my_points) : 0,
        top3: topResultsBySeason.get(Number(row.temporada_id)) || [],
      })),
      meta: {
        limit: safeLimit,
        offset: safeOffset,
        count: seasonRowsResult.rows.length,
      },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.getRanking = async ({ limit = 20 }) => {
  const safeLimit = Math.min(Math.max(Math.floor(Number(limit) || 20), 1), 100);

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await ensureCurrentSeason({ client });

    const result = await client.query(
      `
        SELECT
          u.id AS user_id,
          u.username,
          up.foto_perfil,
          COALESCE(gs.pontos_totais, 0) AS total_points
        FROM users u
        LEFT JOIN gamificacao_saldos gs
          ON gs.user_id = u.id
        LEFT JOIN users_profile up
          ON up.user_id = u.id
        ORDER BY COALESCE(gs.pontos_totais, 0) DESC, u.created_at ASC, u.id ASC
        LIMIT $1
      `,
      [safeLimit],
    );

    await client.query('COMMIT');

    return result.rows.map((row, index) => {
      const totalPoints = Number(row.total_points || 0);
      return {
        posicao: index + 1,
        user_id: row.user_id,
        username: row.username,
        foto_perfil: row.foto_perfil ?? null,
        total_points: totalPoints,
        patente: enrichPatenteProgress(totalPoints),
      };
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports._internal = {
  computeWorkoutPoints,
  enrichPatenteProgress,
  getPatentesRoadmap,
  getSeasonWindowByNumber,
  getSeasonWindowForDate,
  ensureCurrentSeason,
  WORKOUT_SOURCE_TYPE,
  MAX_WORKOUT_POINTS,
  MAX_WORKOUT_POINTS_PREMIUM,
  SEASON_DURATION_MONTHS,
  SEASON_ANCHOR_START_ISO,
};
