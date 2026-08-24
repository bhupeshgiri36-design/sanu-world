// frontend/src/lib/config.js
//
// Base URL of the backend API/Socket.IO server.
//
// The frontend and backend are deployed as two SEPARATE Render services
// (different domains). Relative fetches like `fetch('/api/...')` resolve
// against the frontend's own origin, not the backend — and since the
// frontend is a static SPA, any unknown path there falls back to
// index.html. That's what produced errors like:
//   SyntaxError: Unexpected token '<', "<!doctype "... is not valid JSON
// (the browser was fetching the HTML shell of the frontend app itself,
// not JSON from the backend).
//
// Fix: set VITE_API_URL in the frontend service's Render "Environment"
// settings to the backend service's URL, e.g.:
//   VITE_API_URL=https://sanu-world-backend.onrender.com
// (no trailing slash needed — it's stripped below). Trigger a redeploy
// after adding it, since Vite env vars are baked in at build time.
//
// Locally, if you run the backend alone (it serves the frontend via Vite
// middleware in dev), leave VITE_API_URL unset — requests stay same-origin.
export const API_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
