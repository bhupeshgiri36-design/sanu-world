import express from 'express';
import { adminController } from '../controllers/adminController.js';
import { adminMiddleware } from '../middleware/adminMiddleware.js';
import { adService } from '../services/adService.js';

const router = express.Router();

router.post('/login', adminController.login);
router.post('/logout', adminController.logout);

// Protected routes
router.get('/session', adminMiddleware, adminController.session);
router.get('/stats', adminMiddleware, adminController.getStats);
router.get('/rooms', adminMiddleware, adminController.getRooms);
router.post('/rooms/:code/close', adminMiddleware, adminController.closeRoom);

router.get('/revenue', adminMiddleware, async (req, res) => {
  const stats = await adService.getRevenueStats();
  res.json(stats);
});

export default router;
