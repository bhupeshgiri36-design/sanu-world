// backend/socket/adminAuth.js
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'sanu-super-secret-key-2026';

// Parses the raw cookie header from a socket handshake (sockets don't get
// cookie-parser's req.cookies — that's an Express-only middleware) and
// verifies the admin_token exactly the same way adminMiddleware.js does
// for HTTP requests. Returns the decoded token payload if valid, or null.
export function getAdminFromSocket(socket) {
  try {
    const rawCookies = socket.handshake.headers.cookie || '';
    const cookies = Object.fromEntries(
      rawCookies.split(';').map((c) => c.trim()).filter(Boolean).map((c) => {
        const idx = c.indexOf('=');
        return [decodeURIComponent(c.slice(0, idx)), decodeURIComponent(c.slice(idx + 1))];
      })
    );

    const token = cookies.admin_token;
    if (!token) return null;

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') return null;

    return decoded;
  } catch {
    // Missing, malformed, or expired token — treat as not-admin rather
    // than throwing, since this runs on every socket connection.
    return null;
  }
}
