// backend/utils/rateLimiter.js

export const createRateLimiter = (options = {}) => {
  const {
    windowMs = 60 * 1000,   // 1 minute window
    max = 20,               // max requests per window
    message = 'Too many requests, please try again later.',
  } = options;

  const hits = new Map();

  return (req, res, next) => {
    const ip = getClientIp(req);
    const now = Date.now();

    const record = hits.get(ip);

    if (!record || now - record.start > windowMs) {
      hits.set(ip, { start: now, count: 1 });
      return next();
    }

    record.count += 1;

    if (record.count > max) {
      return res.status(429).json({ error: message });
    }

    next();
  };
};

export const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || 'unknown';
};
