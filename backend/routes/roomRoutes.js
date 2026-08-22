import express from 'express';
import { adminMiddleware } from '../middleware/adminMiddleware.js';
import { roomService } from '../services/roomService.js';

const router = express.Router();

function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Public room info
router.get('/:code', async (req, res) => {
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
});

// Create room (Admin only)
router.post('/create', adminMiddleware, async (req, res) => {
  const rooms = await roomService.getRooms();
  if (rooms.length >= 5) {
    return res.status(403).json({ error: 'Max active rooms reached. Close a room to create a new one.' });
  }
  
  const { name, password, nickname, maxMembers } = req.body;
  if (!name || !nickname) {
    return res.status(400).json({ error: 'Name and nickname are required' });
  }
  
  const code = generateRoomCode();
  
  await roomService.createRoom({
    code,
    name,
    password,
    creatorNickname: nickname,
    maxMembers: maxMembers || 1, // Default visitor limit = 1 (+ host = 2, wait, let's keep it simple)
    is_active: true
  });
  
  res.json({ code, name });
});

// Verify room password
router.post('/:code/verify', async (req, res) => {
  const code = req.params.code.toUpperCase();
  const { password } = req.body;
  const room = await roomService.getRoomByCode(code);
  
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  if (room.password && room.password !== password) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  
  res.json({ success: true });
});

export default router;
