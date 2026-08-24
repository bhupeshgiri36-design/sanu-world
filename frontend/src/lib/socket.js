// frontend/src/lib/socket.js
 
import { io } from 'socket.io-client';
import { API_ORIGIN } from './config';
 
let socket = null;
 
/**
 * Returns a single shared socket instance for the whole app.
 * autoConnect is false because ChatRoom.jsx calls socket.connect()
 * itself once the room lookup succeeds — we don't want a connection
 * racing ahead of that check.
 *
 * Connects to API_ORIGIN (the backend's own domain) rather than the
 * page's own origin, since frontend and backend are separate Render
 * services. withCredentials is required so the admin_token cookie
 * (used by socket/adminAuth.js during the handshake) is actually sent
 * cross-origin.
 */
export function getSocket() {
  if (!socket) {
    socket = io(API_ORIGIN || undefined, {
      autoConnect: false,
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}
