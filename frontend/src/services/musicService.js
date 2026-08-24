// frontend/src/services/musicService.js
//
// Frontend never talks to the music provider directly (per Step 5.3).
// It only talks to our own backend, which talks to the provider adapter.
// This keeps provider swaps (later) confined to the backend.

import { API_ORIGIN } from '../lib/config';

export async function searchTracks(query) {
  if (!query || !query.trim()) return [];

  const res = await fetch(`${API_ORIGIN}/api/music/search?q=${encodeURIComponent(query)}`);

  if (!res.ok) {
    // Per 5.18: surface a clean error, never throw something that could
    // take the chat UI down with it.
    throw new Error('Music service temporarily unavailable');
  }

  const data = await res.json();
  return data.tracks || [];
}
