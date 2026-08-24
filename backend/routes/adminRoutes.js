import express from 'express';
import { adminController } from '../controllers/adminController.js';
import { adminMiddleware } from '../middleware/adminMiddleware.js';
import { ipRateLimit } from '../middleware/rateLimitMiddleware.js';
import { adService } from '../services/adService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
 
const router = express.Router();
 
// Brute-force protection on the admin password. 10 attempts / 10 minutes
// per IP is generous for a real login, tight for someone guessing.
const loginLimiter = ipRateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts. Please wait a few minutes and try again.'
});
 
router.post('/login', loginLimiter, asyncHandler(adminController.login));
router.post('/logout', adminController.logout);
 
// Protected routes
router.get('/session', adminMiddleware, adminController.session);
router.get('/stats', adminMiddleware, asyncHandler(adminController.getStats));
router.get('/rooms', adminMiddleware, asyncHandler(adminController.getRooms));
router.post('/rooms/:code/close', adminMiddleware, asyncHandler(adminController.closeRoom));
 
router.get('/revenue', adminMiddleware, asyncHandler(async (req, res) => {
  const stats = await adService.getRevenueStats();
  res.json(stats);
}));
 
export default router;
