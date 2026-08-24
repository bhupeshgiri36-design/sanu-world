import express from 'express';
import { adminController } from '../controllers/adminController.js';
import { adminMiddleware } from '../middleware/adminMiddleware.js';
import { ipRateLimit } from '../middleware/rateLimitMiddleware.js';
import { adService } from '../services/adService.js';

const router = express.Router();

// Brute-force protection on the admin password. 10 attempts / 10 minutes
// per IP.
const loginLimiter = ipRateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts. Please wait a few minutes and try again.'
});

router.post('/login', loginLimiter, adminController.login);
router.post('/logout', adminController.logout);

// Protected routes
router.get('/session', adminMiddleware, adminController.session);

// Cheap identity check the frontend polls once on load to know whether
// the current admin_token cookie is valid — used app-wide to hide ads
// for a logged-in admin browsing any page, including public rooms.
router.get('/me', adminMiddleware, (req, res) => {
  res.json({ isAdmin: true });
});

router.get('/stats', adminMiddleware, adminController.getStats);
router.get('/rooms', adminMiddleware, adminController.getRooms);
router.post('/rooms/:code/close', adminMiddleware, adminController.closeRoom);

router.get('/revenue', adminMiddleware, async (req, res) => {
  const stats = await adService.getRevenueStats();
  res.json(stats);
});

export default router;
