const db = require('../utils/db');
const { requestRevenueCatSubscriber } = require('./revenuecatService');

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

function parseDate(value) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function pickLaterDate(primary, secondary) {
  if (!primary && !secondary) {
    return null;
  }
  if (primary && !secondary) {
    return primary;
  }
  if (!primary && secondary) {
    return secondary;
  }
  return primary > secondary ? primary : secondary;
}

function computeStatus(expiresAt, gracePeriodEndsAt) {
  const now = new Date();
  if (gracePeriodEndsAt && gracePeriodEndsAt > now) {
    return 'grace_period';
  }
  if (expiresAt && expiresAt > now) {
    return 'active';
  }
  return 'inactive';
}

async function ensureUserExists(userId) {
  const result = await db.query('SELECT id FROM users WHERE id = $1', [userId]);
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

function getRevenueCatConfig() {
  const apiKey = String(process.env.REVENUECAT_SECRET_API_KEY || '').trim();
  const entitlementId = String(process.env.REVENUECAT_ENTITLEMENT_ID || '').trim();
  const productId = String(process.env.REVENUECAT_PRODUCT_ID || '').trim();

  if (!apiKey) {
    throw new Error('REVENUECAT_NOT_CONFIGURED');
  }

  if (!entitlementId && !productId) {
    throw new Error('REVENUECAT_NOT_CONFIGURED');
  }

  return {
    apiKey,
    entitlementId: entitlementId || null,
    productId: productId || null,
  };
}

function pickRevenueCatRecord(subscriber, entitlementId, productId) {
  if (entitlementId && subscriber?.entitlements?.[entitlementId]) {
    return {
      source: 'entitlement',
      record: subscriber.entitlements[entitlementId],
      productId: subscriber.entitlements[entitlementId].product_identifier || null,
    };
  }

  if (productId && subscriber?.subscriptions?.[productId]) {
    return {
      source: 'subscription',
      record: subscriber.subscriptions[productId],
      productId,
    };
  }

  return null;
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

exports.syncFromRevenueCat = async (userId) => {
  await ensureUserExists(userId);

  const { apiKey, entitlementId, productId } = getRevenueCatConfig();
  const data = await requestRevenueCatSubscriber(userId, apiKey);

  const subscriber = data?.subscriber;
  if (!subscriber) {
    throw new Error('REVENUECAT_SUBSCRIBER_NOT_FOUND');
  }

  const picked = pickRevenueCatRecord(subscriber, entitlementId, productId);
  if (!picked) {
    throw new Error('REVENUECAT_SUBSCRIBER_NOT_FOUND');
  }

  const expiresAt = parseDate(picked.record?.expires_date);
  const gracePeriodEndsAt = parseDate(picked.record?.grace_period_expires_date);
  const currentPeriodEndsAt = pickLaterDate(expiresAt, gracePeriodEndsAt);
  const status = computeStatus(expiresAt, gracePeriodEndsAt);

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
       'revenuecat',
       $2,
       $3,
       $4,
       $5,
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
    [
      userId,
      picked.productId,
      status,
      currentPeriodEndsAt,
      {
        source: picked.source,
        entitlementId,
        productId,
        subscriber,
      },
    ],
  );

  const mapped = toPremiumModel(result.rows[0]);
  await syncPremiumCache(userId, mapped.is_premium);
  return mapped;
};
