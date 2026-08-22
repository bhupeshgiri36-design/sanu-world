// frontend/src/lib/socket.js

import { io } from 'socket.io-client';

let socket = null;

/**
 * Returns a single shared socket instance for the whole app.
 * autoConnect is false because ChatRoom.jsx calls socket.connect()
 * itself once the room lookup succeeds — we don't want a connection
 * racing ahead of that check.
 */
export function getSocket() {
  if (!socket) {
    socket = io({
      autoConnect: false,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}