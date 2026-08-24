// backend/controllers/musicController.js
 
import { musicService } from '../services/musicService.js';
 
// GET /api/music/search?q=love
export async function searchMusic(req, res) {
  const query = req.query.q;
 
  if (!query || !query.trim()) {
    return res.status(400).json({ error: 'Missing search query' });
  }
 
  try {
    const tracks = await musicService.searchTracks(query);
    res.json({ tracks });
  } catch (err) {
    console.error('Music search failed:', err.message);
    // Per Step 5.18: chat must keep working even if the music provider is
    // down. This just tells the frontend "music unavailable right now" —
    // it never touches room/chat state.
    res.status(502).json({ error: 'Music service temporarily unavailable' });
  }
}
 
// GET /api/music/tracks/:id
export async function getMusicTrack(req, res) {
  const { id } = req.params;
 
  try {
    const track = await musicService.getTrack(id);
    if (!track) {
      return res.status(404).json({ error: 'Track not found' });
    }
    res.json({ track });
  } catch (err) {
    console.error('Music track lookup failed:', err.message);
    res.status(502).json({ error: 'Music service temporarily unavailable' });
  }
}
