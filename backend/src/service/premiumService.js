const db = require('../utils/db');

const ACTIVE_STATUSES = ['active', 'grace_period'];

function toPremiumModel(row) {
  const untilDate = row.current_period_ends_at ? new Date(row.current_period_ends_at) : null;
  const now = new Date();
  const isStatusActive = ACTIVE_STATUSES.includes(String(row.status || '').toLowerCase());
  const isStillValid = Boolean(untilDate && untilDate > now);
  const isPremium = isStatusActive && isStillValid;

  return {
    id: row.user_id,
    is_premium: isPremium,
    premium_status: row.status,
    premium_source: row.provider,
    premium_until: row.current_period_ends_at,
    premium_updated_at: row.updated_at,
  };
}

async function ensureUserExists(userId) {
  const result = await db.query(`SELECT id FROM users WHERE id = $1`, [userId]);
  if (result.rows.length === 0) {
    throw new Error('USER_NOT_FOUND');
  }
}

async function syncPremiumCache(userId, isPremium) {
  await db.query(
    `UPDATE users
     SET is_premium = $2,
         premium_updated_at = NOW()
     WHERE id = $1`,
    [userId, isPremium],
  );
}

exports.getPremiumStatus = async (userId) => {
  await ensureUserExists(userId);

  const result = await db.query(
    `SELECT user_id, provider, status, current_period_ends_at, updated_at
     FROM user_subscriptions
     WHERE user_id = $1
     ORDER BY updated_at DESC
     LIMIT 1`,
    [userId],
  );

  if (result.rows.length === 0) {
    const fallback = {
      id: userId,
      is_premium: false,
      premium_status: 'inactive',
      premium_source: null,
      premium_until: null,
      premium_updated_at: null,
    };
    await syncPremiumCache(userId, fallback.is_premium);
    return fallback;
  }

  const mapped = toPremiumModel(result.rows[0]);
  await syncPremiumCache(userId, mapped.is_premium);
  return mapped;
};

exports.activatePremiumFake = async (userId, durationDays = 30) => {
  await ensureUserExists(userId);

  const normalizedDays = Math.max(1, Number(durationDays) || 30);
  const result = await db.query(
    `INSERT INTO user_subscriptions (
       user_id,
       provider,
       product_id,
       status,
       current_period_ends_at,
       raw_payload,
       updated_at
     )
     VALUES (
       $1,
       'manual_test',
       'premium_test',
       'active',
       NOW() + ($2 || ' days')::INTERVAL,
       jsonb_build_object('mode', 'manual_test', 'durationDays', $2::int),
       NOW()
     )
     ON CONFLICT (user_id, provider)
     DO UPDATE SET
       product_id = EXCLUDED.product_id,
       status = EXCLUDED.status,
       current_period_ends_at = EXCLUDED.current_period_ends_at,
       raw_payload = EXCLUDED.raw_payload,
       updated_at = NOW()
     RETURNING user_id, provider, status, current_period_ends_at, updated_at`,
    [userId, String(normalizedDays)],
  );

  const mapped = toPremiumModel(result.rows[0]);
  await syncPremiumCache(userId, mapped.is_premium);
  return mapped;
};

exports.deactivatePremiumFake = async (userId) => {
  await ensureUserExists(userId);

  const result = await db.query(
    `INSERT INTO user_subscriptions (
       user_id,
       provider,
       product_id,
       status,
       current_period_ends_at,
       raw_payload,
       updated_at
     )
     VALUES (
       $1,
       'manual_test',
       'premium_test',
       'inactive',
       NULL,
       jsonb_build_object('mode', 'manual_test'),
       NOW()
     )
     ON CONFLICT (user_id, provider)
     DO UPDATE SET
       status = 'inactive',
       current_period_ends_at = NULL,
       raw_payload = EXCLUDED.raw_payload,
       updated_at = NOW()
     RETURNING user_id, provider, status, current_period_ends_at, updated_at`,
    [userId],
  );

  const mapped = toPremiumModel(result.rows[0]);
  await syncPremiumCache(userId, mapped.is_premium);
  return mapped;
};
