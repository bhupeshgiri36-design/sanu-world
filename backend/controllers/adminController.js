import jwt from 'jsonwebtoken';
import { roomService } from '../services/roomService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'sanu-super-secret-key-2026';

// Admin credentials now live only in environment variables — set
// ADMIN_EMAIL / ADMIN_PASSWORD in your backend .env (or Render's
// Environment tab). No database, no hardcoded values in source.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'sanu@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password123';

export const adminController = {
  login: async (req, res) => {
    const { email, password } = req.body;

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      const token = jwt.sign({ id: 1, role: 'admin', email }, JWT_SECRET, { expiresIn: '1d' });
      res.cookie('admin_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
      return res.json({ success: true });
    }

    return res.status(401).json({ error: 'Invalid credentials' });
  },

  logout: (req, res) => {
    res.clearCookie('admin_token');
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
    const roomsList = rooms.map(room => ({
      code: room.code,
      name: room.name,
      members: room.members?.size || 0,
      maxMembers: room.maxMembers
    }));
    res.json(roomsList);
  },

  closeRoom: async (req, res) => {
    const code = req.params.code.toUpperCase();
    const room = await roomService.getRoomByCode(code);

    if (room) {
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
