import express from 'express';
import { adminMiddleware } from '../middleware/adminMiddleware.js';
import { ipRateLimit } from '../middleware/rateLimitMiddleware.js';
import { roomService } from '../services/roomService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
 
const router = express.Router();
 
// Someone guessing a room password (or brute-forcing room codes via the
// public lookup) shouldn't be able to hammer this endpoint unthrottled.
const verifyLimiter = ipRateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: 'Too many attempts. Please wait a few minutes and try again.'
});
const lookupLimiter = ipRateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many requests. Please slow down.'
});
 
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
 
// Public room info
router.get('/:code', lookupLimiter, asyncHandler(async (req, res) => {
  const code = req.params.code.toUpperCase();
  const room = await roomService.getRoomByCode(code);
 
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
 
  res.json({
    code: room.code,
    name: room.name,
    members: room.members?.size || 0,
    maxMembers: room.maxMembers,
    requiresPassword: !!room.password
  });
}));
 
// Create room (Admin only)
router.post('/create', adminMiddleware, asyncHandler(async (req, res) => {
  const rooms = await roomService.getRooms();
  const realRoomCount = rooms.filter(r => r.code !== 'DEMO12').length;
  if (realRoomCount >= 5) {
    return res.status(403).json({ error: 'Max active rooms reached. Close a room to create a new one.' });
  }
 
  const { name, password, nickname, maxMembers } = req.body || {};
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  const trimmedNickname = typeof nickname === 'string' ? nickname.trim() : '';
 
  if (!trimmedName || !trimmedNickname) {
    return res.status(400).json({ error: 'Name and nickname are required' });
  }
  if (trimmedName.length > 30 || trimmedNickname.length > 20) {
    return res.status(400).json({ error: 'Name or nickname is too long' });
  }
 
  const parsedMax = parseInt(maxMembers, 10);
  const safeMax = Number.isFinite(parsedMax) ? Math.min(Math.max(parsedMax, 2), 50) : 2;
 
  // Retry once on the (very unlikely) chance of a room-code collision —
  // `code` is the primary key, so a collision would otherwise surface as a
  // confusing duplicate-key 500 instead of just trying again.
  let code = generateRoomCode();
  let created;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      created = await roomService.createRoom({
        code,
        name: trimmedName,
        password: password || '',
        creatorNickname: trimmedNickname,
        maxMembers: safeMax,
      });
      break;
    } catch (err) {
      const isDuplicateCode = err?.code === '23505'; // Postgres unique_violation
      if (isDuplicateCode && attempt < 2) {
        code = generateRoomCode();
        continue;
      }
      throw err;
    }
  }
 
  res.json({ code: created.code, name: created.name });
}));
 
// Verify room password
router.post('/:code/verify', verifyLimiter, asyncHandler(async (req, res) => {
  const code = req.params.code.toUpperCase();
  const { password } = req.body || {};
  const room = await roomService.getRoomByCode(code);
 
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
 
  if (room.password && room.password !== password) {
    return res.status(401).json({ error: 'Invalid password' });
  }
 
  res.json({ success: true });
}));
 
export default router;
 
