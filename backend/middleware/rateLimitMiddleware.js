// backend/middleware/rateLimitMiddleware.js

// Simple in-memory sliding-window rate limiter, keyed by IP.
// Good enough for a single-instance Render deployment. If you ever scale
// to multiple instances, this would need to move to Redis or similar.
const buckets = new Map();

export function ipRateLimit({ windowMs, max, message = 'Too many requests, please try again later.' }) {
  return (req, res, next) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    let entry = buckets.get(ip);
    if (!entry || now - entry.windowStart > windowMs) {
      entry = { windowStart: now, count: 0 };
      buckets.set(ip, entry);
    }

    entry.count += 1;

    if (entry.count > max) {
      const retryAfterSec = Math.ceil((entry.windowStart + windowMs - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      return res.status(429).json({ error: message });
    }

    next();
  };
}

// Periodic cleanup so the map doesn't grow forever with stale IPs.
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of buckets.entries()) {
    if (now - entry.windowStart > 30 * 60 * 1000) buckets.delete(ip);
  }
}, 10 * 60 * 1000).unref();
