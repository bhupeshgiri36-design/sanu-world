// backend/utils/rateLimiter.js
//
// Generic per-socket flood guard. Wraps a socket.io event handler so a
// single socket can't fire it more than `max` times per `windowMs`. Used
// throughout chatSocket.js to stop abuse (message spam, join floods,
// rapid-fire typing events, etc.) without needing a separate limiter
// written per event.
//
// Usage:
//   const limitedHandler = createRateLimiter(actualHandler, { windowMs: 10000, max: 20 });
//   socket.on('send-message', limitedHandler);

export function createRateLimiter(handler, { windowMs = 10000, max = 20, onLimitExceeded } = {}) {
  const hits = [];

  return function rateLimitedHandler(...args) {
    const now = Date.now();

    // Drop timestamps outside the current window.
    while (hits.length > 0 && now - hits[0] > windowMs) {
      hits.shift();
    }

    if (hits.length >= max) {
      if (typeof onLimitExceeded === 'function') {
        onLimitExceeded(...args);
      } else {
        // If the handler was called with a socket.io ack callback as the
        // last argument, respond with an error instead of silently
        // dropping the event.
        const maybeCallback = args[args.length - 1];
        if (typeof maybeCallback === 'function') {
          maybeCallback({ error: 'Too many requests. Please slow down.' });
        }
      }
      return;
    }

    hits.push(now);
    return handler(...args);
  };
}
