// backend/utils/asyncHandler.js
//
// Express 4 does NOT automatically catch rejected promises thrown inside
// an `async (req, res) => {}` route handler — an unhandled rejection there
// just hangs the request or crashes the process, it never reaches
// Express's error-handling middleware on its own. Every route in this app
// that can throw (anything touching roomService, file I/O, etc.) is
// wrapped in this so failures always end up as a clean JSON error response
// via the global error handler in server.js, instead of a hung request or
// an HTML stack-trace page.
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
