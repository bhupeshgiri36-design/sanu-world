// frontend/src/lib/keepAlive.js
import { API_ORIGIN } from './config';

const PING_INTERVAL_MS = 4 * 60 * 1000; // under Render's 15-min idle timeout

export function startKeepAlive() {
  const ping = () => {
    fetch(`${API_ORIGIN}/healthz`, { cache: 'no-store' }).catch(() => {});
  };

  ping(); // once immediately on load
  const id = setInterval(ping, PING_INTERVAL_MS);
  return () => clearInterval(id);
}
