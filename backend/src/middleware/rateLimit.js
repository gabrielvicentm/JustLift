const DEFAULT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const DEFAULT_BLOCK_MS = Number(process.env.RATE_LIMIT_BLOCK_MS || 15 * 60 * 1000);

const buckets = new Map();

function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  const proxyIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  const ip = (proxyIp || req.ip || req.socket?.remoteAddress || 'unknown')
    .toString()
    .split(',')[0]
    .trim();
  return ip || 'unknown';
}

function makeKey(req, extra) {
  const ip = getClientIp(req);
  return extra ? `${ip}:${extra}` : ip;
}

function resolveIdentifier(req) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const identifier = String(req.body?.identifier || '').trim().toLowerCase();
  const googleId = String(req.body?.google_id || '').trim();
  return email || identifier || googleId || '';
}

function getBucket(key, windowMs) {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing) {
    const fresh = {
      count: 0,
      windowStartedAt: now,
      blockedUntil: 0,
    };
    buckets.set(key, fresh);
    return fresh;
  }

  if (now - existing.windowStartedAt >= windowMs) {
    existing.count = 0;
    existing.windowStartedAt = now;
  }

  return existing;
}

function createRateLimiter(options) {
  const windowMs = Number.isFinite(options?.windowMs) ? options.windowMs : DEFAULT_WINDOW_MS;
  const max = Number.isFinite(options?.max) ? options.max : 10;
  const blockMs = Number.isFinite(options?.blockMs) ? options.blockMs : DEFAULT_BLOCK_MS;
  const keyGenerator = typeof options?.keyGenerator === 'function' ? options.keyGenerator : null;

  return (req, res, next) => {
    const key = keyGenerator ? keyGenerator(req) : makeKey(req);
    const bucket = getBucket(key, windowMs);
    const now = Date.now();

    if (bucket.blockedUntil > now) {
      const retryAfterSeconds = Math.ceil((bucket.blockedUntil - now) / 1000);
      res.set('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        message: 'Muitas tentativas. Tente novamente mais tarde.',
        retryAfterSeconds,
      });
    }

    bucket.count += 1;

    if (bucket.count > max) {
      bucket.blockedUntil = now + blockMs;
      bucket.count = 0;
      bucket.windowStartedAt = now;
      const retryAfterSeconds = Math.ceil(blockMs / 1000);
      res.set('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        message: 'Muitas tentativas. Tente novamente mais tarde.',
        retryAfterSeconds,
      });
    }

    return next();
  };
}

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  blockMs: 30 * 60 * 1000,
  keyGenerator: (req) => makeKey(req, resolveIdentifier(req)),
});

const otpLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  blockMs: 30 * 60 * 1000,
  keyGenerator: (req) => makeKey(req, String(req.body?.email || '').trim().toLowerCase()),
});

const googleLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 8,
  blockMs: 30 * 60 * 1000,
  keyGenerator: (req) => makeKey(req, resolveIdentifier(req)),
});

const accountChangeLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  blockMs: 30 * 60 * 1000,
  keyGenerator: (req) => makeKey(req, String(req.user?.userId || req.user?.id || '')),
});

const mediaLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  blockMs: 30 * 60 * 1000,
  keyGenerator: (req) => makeKey(req, String(req.user?.userId || req.user?.id || '')),
});

module.exports = {
  createRateLimiter,
  authLimiter,
  otpLimiter,
  googleLimiter,
  accountChangeLimiter,
  mediaLimiter,
};
