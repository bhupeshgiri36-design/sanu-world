import jwt from 'jsonwebtoken';
import { roomService } from '../services/roomService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'sanu-super-secret-key-2026';

// Admin credentials — configurable via env vars so production doesn't have
// to ship with the hardcoded dev defaults. There is no database/user table
// in this app; admin auth is a single set of credentials checked in code.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'sanu@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password123';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
};

export const adminController = {
  login: async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      const token = jwt.sign({ id: 1, role: 'admin', email }, JWT_SECRET, { expiresIn: '1d' });
      res.cookie('admin_token', token, COOKIE_OPTIONS);
      return res.json({ success: true });
    }
    return res.status(401).json({ error: 'Invalid credentials' });
  },
  logout: (req, res) => {
    // clearCookie must be called with the SAME options (secure/sameSite)
    // used when the cookie was set, or the browser won't recognize it
    // as the same cookie and won't actually clear it.
    res.clearCookie('admin_token', COOKIE_OPTIONS);
    res.json({ success: true });
  },
  session: (req, res) => {
    // If it reached here, adminMiddleware passed
    res.json({ success: true, admin: req.admin });
  },
  getStats: async (req, res) => {
    const rooms = await roomService.getRooms();
    let totalOnline = 0;
    let totalMessages = 0;
    rooms.forEach(room => {
      totalOnline += (room.members?.size || 0);
      totalMessages += (room.messages?.length || 0);
    });
    res.json({
      activeRooms: rooms.length,
      totalOnline,
      totalMessages
    });
  },
  getRooms: async (req, res) => {
    const rooms = await roomService.getRooms();
    const roomsList = rooms.map(room => {
      // `maxMembers` caps friends, not Sanu's own extra devices (see
      // friendCount() in chatSocket.js) — report both numbers so the
      // admin panel doesn't show a confusing "3/2" when Sanu is just
      // connected from a second device. `members` stays the raw total
      // (useful as a general "how many sockets right now" figure);
      // `friends` is the number that's actually being compared to
      // maxMembers server-side.
      let friends = 0;
      if (room.members) {
        for (const m of room.members.values()) {
          if (!m.isAdmin) friends++;
        }
      }
      return {
        code: room.code,
        name: room.name,
        members: room.members?.size || 0,
        friends,
        maxMembers: room.maxMembers
      };
    });
    res.json(roomsList);
  },
  closeRoom: async (req, res) => {
    const code = req.params.code.toUpperCase();
    const room = await roomService.getRoomByCode(code);
    if (room) {
      // Clear any pending reconnect-grace timers so they don't fire later
      // against a room we're about to delete.
      if (room.pendingDisconnects) {
        for (const { timeout } of room.pendingDisconnects.values()) clearTimeout(timeout);
        room.pendingDisconnects.clear();
      }
      req.io.to(code).emit('room-closed', { endedBy: 'admin' });
      req.io.in(code).socketsJoin('closed-room');
      req.io.sockets.in(code).disconnectSockets(true);
      await roomService.deleteRoom(code);
    }
    res.json({ success: true });
  }
};
