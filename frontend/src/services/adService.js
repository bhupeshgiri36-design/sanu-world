// frontend/src/services/adService.js
//
// Fire-and-forget impression tracking from the browser. Never blocks or
// throws into the caller — a failed tracking ping should never break ad
// rendering or the rest of the page. Posts to the backend's
// /api/ads/impression route, which is what your backend adService.js
// (Supabase-backed) should be recording into ad_events.
import { API_ORIGIN } from '../lib/config';

const API_BASE = `${API_ORIGIN}/api`;

export const adService = {
  recordImpression(provider, placement) {
    fetch(`${API_BASE}/ads/impression`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, placement }),
    }).catch(() => {
      // Silently ignore — impression tracking failing should never affect
      // the user's experience.
    });
  },
};
