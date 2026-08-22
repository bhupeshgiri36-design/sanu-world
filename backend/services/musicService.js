// backend/services/musicService.js
//
// Provider adapter for music search/streaming.
// Per Step 5.1/5.3: this is the ONLY file that knows the provider is Audius.
// Everything else (controller, routes, frontend) talks to this file's
// normalized shape { id, title, artist, artwork, duration, streamUrl } and
// never touches Audius-specific fields directly. Swapping providers later
// means editing only this file.
//
// Provider: Audius (https://audius.co) — decentralized, open music catalog.
// Artists opt in specifically to be streamed by third-party apps, so this
// is an authorized API integration, not scraping. No API key is required
// for read-only search/stream; `app_name` is sent for identification per
// Audius's own recommendation.

const AUDIUS_BASE = 'https://api.audius.co/v1';
const APP_NAME = 'SanuWorld';

function normalizeTrack(track) {
  if (!track) return null;
  return {
    id: track.id,
    title: track.title,
    artist: track.user?.name || 'Unknown Artist',
    artwork: track.artwork?.['480x480'] || track.artwork?.['150x150'] || null,
    duration: track.duration || 0,
    // Streaming endpoint supports Range requests, so it can be dropped
    // straight into an <audio>/ReactPlayer src with no further resolving.
    streamUrl: `${AUDIUS_BASE}/tracks/${track.id}/stream?app_name=${APP_NAME}`,
  };
}

async function searchTracks(query, limit = 10) {
  if (!query || !query.trim()) {
    return [];
  }

  const url = `${AUDIUS_BASE}/tracks/search?query=${encodeURIComponent(query)}&app_name=${APP_NAME}&limit=${limit}`;

  const res = await fetch(url);
  if (!res.ok) {
    // Per Step 5.18: music failures must never crash the room. Throw here;
    // the controller catches it and returns a clean error the frontend can
    // show without the chat itself being affected.
    throw new Error(`Audius search failed with status ${res.status}`);
  }

  const data = await res.json();
  const tracks = Array.isArray(data.data) ? data.data : [];
  return tracks.map(normalizeTrack).filter(Boolean);
}

async function getTrack(trackId) {
  if (!trackId) return null;

  const url = `${AUDIUS_BASE}/tracks/${encodeURIComponent(trackId)}?app_name=${APP_NAME}`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Audius track lookup failed with status ${res.status}`);
  }

  const data = await res.json();
  return normalizeTrack(data.data);
}

export const musicService = {
  searchTracks,
  getTrack,
};