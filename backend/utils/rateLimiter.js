// backend/utils/rateLimiter.js

export const createRateLimiter = (options = {}) => {
  const {
    windowMs = 60 * 1000,   // 1 minute window
    max = 20,               // max requests per window
  } = options;

  const hits = new Map();

  // Plain key -> {allowed, retryAfterMs} check. Callers (Express route
  // middleware in rateLimitMiddleware.js, the Socket.IO connection guard
  // in server.js, and the in-socket flood checks in chatSocket.js) all
  // call this directly with an ip/socket-id string and handle the
  // req/res/next side themselves — this function must NOT be an Express
  // middleware itself.
  return (key) => {
    const now = Date.now();

    const record = hits.get(key);

    if (!record || now - record.start > windowMs) {
      hits.set(key, { start: now, count: 1 });
      return { allowed: true };
    }

    record.count += 1;

    if (record.count > max) {
      return { allowed: false, retryAfterMs: windowMs - (now - record.start) };
    }

    return { allowed: true };
  };
};

export const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || 'unknown';
};
