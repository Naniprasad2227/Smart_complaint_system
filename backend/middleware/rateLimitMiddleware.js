const stores = new Map();

const getClientKey = (req) => {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.ip || req.connection?.remoteAddress || 'unknown';
};

const createRateLimiter = ({ windowMs, maxRequests, message }) => {
  return (req, res, next) => {
    const key = `${req.baseUrl}:${req.path}:${getClientKey(req)}`;
    const now = Date.now();
    const expiresAt = now + windowMs;

    const current = stores.get(key);
    if (!current || current.expiresAt <= now) {
      stores.set(key, { count: 1, expiresAt });
      return next();
    }

    if (current.count >= maxRequests) {
      const retryAfter = Math.max(1, Math.ceil((current.expiresAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ message });
    }

    current.count += 1;
    stores.set(key, current);
    return next();
  };
};

module.exports = {
  createRateLimiter,
};
