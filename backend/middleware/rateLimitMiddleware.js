// backend/middleware/rateLimitMiddleware.js
import { createRateLimiter, getClientIp } from '../utils/rateLimiter.js';
 
/**
 * Express middleware: limits requests per client IP within `windowMs`.
 * Use a separate limiter instance per route so a burst on one endpoint
 * doesn't eat another endpoint's budget.
 */
export function ipRateLimit({ windowMs, max, message }) {
  const check = createRateLimiter({ windowMs, max });
  return (req, res, next) => {
    const ip = getClientIp(req);
    const result = check(ip);
    if (!result.allowed) {
      res.set('Retry-After', Math.ceil(result.retryAfterMs / 1000).toString());
      return res.status(429).json({ error: message || 'Too many requests. Please try again shortly.' });
    }
    next();
  };
}
 
