const db = require('../../utils/db');

const WORKOUT_SOURCE_TYPE = 'workout_save';
const MAX_WORKOUT_POINTS = 300;

const PATENTES = [
  { minPoints: 0, key: 'recruta', label: 'Recruta' },
  { minPoints: 1000, key: 'soldado', label: 'Soldado' },
  { minPoints: 3000, key: 'cabo', label: 'Cabo' },
  { minPoints: 7000, key: 'sargento', label: 'Sargento' },
  { minPoints: 15000, key: 'tenente', label: 'Tenente' },
  { minPoints: 30000, key: 'capitao', label: 'Capitão' },
  { minPoints: 60000, key: 'major', label: 'Major' },
  { minPoints: 100000, key: 'coronel', label: 'Coronel' },
  { minPoints: 150000, key: 'general', label: 'General' },
];

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

const getClient = async (providedClient) => {
  if (providedClient) {
    return { client: providedClient, shouldRelease: false };
  }

  const client = await db.connect();
  return { client, shouldRelease: true };
};

const computeWorkoutPoints = (volumeTotal) => {
  const safeVolume = Number.isFinite(Number(volumeTotal)) ? Number(volumeTotal) : 0;
  const rawPoints = Math.floor(safeVolume / 100);
  return Math.max(0, Math.min(rawPoints, MAX_WORKOUT_POINTS));
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

    if (safePoints === 0) {
      const totalPoints = await getTotalPoints({ userId, client });
      if (!providedClient) await client.query('COMMIT');
      return {
        awarded: false,
        pointsAwarded: 0,
        totalPoints,
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
      const totalPoints = await getTotalPoints({ userId, client: resolvedClient });
      return {
        awarded: false,
        pointsAwarded: 0,
        totalPoints,
        patente: enrichPatenteProgress(totalPoints),
      };
    } finally {
      if (shouldRelease) resolvedClient.release();
    }
  }

  const points = computeWorkoutPoints(volumeTotal);
  return exports.grantPoints({
    userId,
    points,
    sourceType: WORKOUT_SOURCE_TYPE,
    sourceId: workoutId ? String(workoutId) : null,
    metadata: {
      rule: 'volume_total_div_100_capped_300',
      volume_total: Number.isFinite(Number(volumeTotal)) ? Number(volumeTotal) : 0,
    },
    client,
  });
};

exports.getMyGamificacao = async ({ userId }) => {
  const client = await db.connect();
  try {
    const totalPoints = await getTotalPoints({ userId, client });
    return {
      totalPoints,
      patente: enrichPatenteProgress(totalPoints),
    };
  } finally {
    client.release();
  }
};

exports.getMyGamificacaoHistorico = async ({ userId, limit = 30, offset = 0 }) => {
  const safeLimit = Math.min(Math.max(Math.floor(Number(limit) || 30), 1), 100);
  const safeOffset = Math.max(Math.floor(Number(offset) || 0), 0);

  const result = await db.query(
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

  return {
    eventos: result.rows,
    meta: {
      limit: safeLimit,
      offset: safeOffset,
      count: result.rows.length,
    },
  };
};

exports.getRanking = async ({ limit = 20 }) => {
  const safeLimit = Math.min(Math.max(Math.floor(Number(limit) || 20), 1), 100);

  const result = await db.query(
    `
      SELECT
        u.id AS user_id,
        u.username,
        COALESCE(gs.pontos_totais, 0) AS total_points
      FROM users u
      LEFT JOIN gamificacao_saldos gs
        ON gs.user_id = u.id
      ORDER BY COALESCE(gs.pontos_totais, 0) DESC, u.created_at ASC
      LIMIT $1
    `,
    [safeLimit],
  );

  return result.rows.map((row, index) => {
    const totalPoints = Number(row.total_points || 0);
    return {
      posicao: index + 1,
      user_id: row.user_id,
      username: row.username,
      total_points: totalPoints,
      patente: enrichPatenteProgress(totalPoints),
    };
  });
};

exports._internal = {
  computeWorkoutPoints,
  enrichPatenteProgress,
  WORKOUT_SOURCE_TYPE,
  MAX_WORKOUT_POINTS,
};
