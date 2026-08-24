// backend/routes/musicRoutes.js
//
// Step 5.1 scope only: search + track lookup (read-only HTTP).
// Play/pause/change/seek are socket events with host-only authorization —
// those come in a later step per the plan doc, alongside the room's music
// state (5.6+). Nothing here mutates room state.
 
import express from 'express';
import { searchMusic, getMusicTrack } from '../controllers/musicController.js';
 
const router = express.Router();
 
router.get('/search', searchMusic);
router.get('/tracks/:id', getMusicTrack);
 
export default router;
