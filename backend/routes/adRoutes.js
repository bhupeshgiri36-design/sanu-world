import express from 'express';
import { adService } from '../services/adService.js';

const router = express.Router();

// Public — called by every visitor's browser, not just Sanu.
router.post('/impression', async (req, res) => {
  const { provider, placement } = req.body;
  try {
    await adService.recordImpression(provider, placement);
  } catch {
    // Tracking failures should never surface as an error to the visitor.
  }
  res.json({ ok: true });
});

export default router;
