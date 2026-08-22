import jwt from 'jsonwebtoken';
import { roomService } from '../services/roomService.js';
import { getSupabase } from '../config/supabase.js';

const JWT_SECRET = process.env.JWT_SECRET || 'sanu-super-secret-key-2026';

export const adminController = {
  login: async (req, res) => {
    const { email, password } = req.body;

    const supabase = getSupabase();
    if (supabase) {
      // Real auth path: verify against the users table.
      const { data: adminUser } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('role', 'admin')
        .single();

      // NOTE: passwords should be hashed (bcrypt) before this compares them directly.
      if (adminUser && adminUser.password === password) {
        const token = jwt.sign({ id: adminUser.id, role: 'admin', email }, JWT_SECRET, { expiresIn: '1d' });
        res.cookie('admin_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
        return res.json({ success: true });
      }

      // Supabase IS configured, so don't silently fall through to the
      // hardcoded dev credentials in production — that was the bug.
      if (process.env.NODE_ENV === 'production') {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    }

    // Hardcoded dev credentials — only reachable in non-production, or when
    // Supabase isn't configured yet (local/in-memory dev mode).
    if (email === 'sanu@example.com' && password === 'password123') {
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

    // This logic works with in-memory map structure for now
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
      // Clear any pending reconnect-grace timers so they don't fire later
      // against a room we're about to delete.
      if (room.pendingDisconnects) {
        for (const { timeout } of room.pendingDisconnects.values()) clearTimeout(timeout);
        room.pendingDisconnects.clear();
      }
      // Logic to tell socket server to close the room
      req.io.to(code).emit('room-closed', { endedBy: 'admin' });
      req.io.in(code).socketsJoin('closed-room');
      req.io.sockets.in(code).disconnectSockets(true);
      await roomService.deleteRoom(code);
    }
    res.json({ success: true });
  }
};