// backend/socket/chatSocket.js

import { roomService } from '../services/roomService.js';

// How long a disconnected participant has to reconnect before we treat it
// as a real departure. Host disconnect => room would otherwise be destroyed
// instantly; visitor disconnect => they'd otherwise be dropped from the
// member list instantly. A brief wifi drop or backgrounded tab shouldn't end
// the conversation.
const RECONNECT_GRACE_MS = 20 * 1000;

export function setupSocketHandlers(io) {
  const lastMessageTimes = new Map();

  io.on('connection', (socket) => {
    let currentRoom = null;
    let currentUser = null;

    socket.on('join-room', async ({ roomCode, nickname, password }, callback) => {
      const code = (roomCode || '').toUpperCase();
      const room = await roomService.getRoomByCode(code);

      if (!room) {
        if (callback) callback({ error: 'Room not found' });
        return;
      }

      if (room.password && room.password !== password) {
        if (callback) callback({ error: 'Invalid password' });
        return;
      }

      if (!room.pendingDisconnects) room.pendingDisconnects = new Map();

      // A reconnect gets a NEW socket.id, so we match it back to its old
      // session by nickname rather than by socket id.
      const pending = room.pendingDisconnects.get(nickname);
      const isReconnecting = !!pending;

      if (!isReconnecting && room.members.size >= room.maxMembers && !room.members.has(socket.id)) {
        if (callback) callback({ error: 'This room is full' });
        return;
      }

      if (isReconnecting) {
        clearTimeout(pending.timeout);
        room.pendingDisconnects.delete(nickname);
      }

      const isHost = isReconnecting ? pending.isHost : (room.creatorNickname === nickname || code === 'DEMO12');
      currentRoom = code;
      currentUser = { id: socket.id, nickname, isHost };

      room.members.set(socket.id, currentUser);
      room.emptySince = undefined;

      socket.join(code);

      if (callback) {
        callback({
          success: true,
          room: {
            code: room.code,
            name: room.name,
            messages: room.messages,
            members: Array.from(room.members.values()),
            music: room.music
          },
          isHost,
          reconnected: isReconnecting
        });
      }

      if (isReconnecting) {
        io.to(code).emit('user-reconnected', currentUser);
      } else {
        socket.to(code).emit('user-joined', currentUser);
      }
      io.to(code).emit('online-count', room.members.size);
    });

    // Frontend sends either a plain text string, or a base64 image data-URL string.
    socket.on('send-message', async (messageData, callback) => {
      if (!currentRoom || !currentUser) {
        if (callback) callback({ error: 'Not connected to a room' });
        return;
      }

      const room = await roomService.getRoomByCode(currentRoom);
      if (!room) {
        if (callback) callback({ error: 'Room no longer exists' });
        return;
      }

      const now = Date.now();
      const lastTime = lastMessageTimes.get(socket.id) || 0;
      if (now - lastTime < 500) {
        if (callback) callback({ error: 'Please wait before sending another message' });
        return;
      }

      // Accept either a raw string or a { text } object, but never trust the shape blindly.
      const text = typeof messageData === 'string' ? messageData : messageData?.text;

      if (!text || typeof text !== 'string' || !text.trim()) {
        if (callback) callback({ error: 'Empty message' });
        return;
      }

      const isImage = text.startsWith('data:image/');

      if (isImage) {
        // ~2MB image -> base64 is ~2.7MB of text; give some headroom.
        if (text.length > 3 * 1024 * 1024) {
          if (callback) callback({ error: 'Image too large' });
          return;
        }
      } else if (text.length > 1000) {
        if (callback) callback({ error: 'Message too long' });
        return;
      }

      lastMessageTimes.set(socket.id, now);

      const message = {
        id: Math.random().toString(36).substr(2, 9),
        userId: currentUser.id,
        nickname: currentUser.nickname,
        text,
        type: isImage ? 'image' : 'text',
        timestamp: Date.now(),
        isHost: currentUser.isHost
      };

      if (room.messages.length >= 100) {
        room.messages.shift();
      }
      room.messages.push(message);

      io.to(currentRoom).emit('receive-message', message);
      if (callback) callback({ success: true });
    });

    // Host picks a new track. Broadcast to everyone (including host) so the
    // shared music bar switches out of "paste a URL" mode for both sides.
    socket.on('set-music', async (url) => {
      if (!currentRoom || !currentUser?.isHost || !url) return;
      const room = await roomService.getRoomByCode(currentRoom);
      if (room) {
        room.music = { url, playing: true, timestamp: Date.now() };
        io.to(currentRoom).emit('music-update', room.music);
      }
    });

    // Host toggles play/pause.
    socket.on('music-state', async (playing) => {
      if (!currentRoom || !currentUser?.isHost) return;
      const room = await roomService.getRoomByCode(currentRoom);
      if (room && room.music?.url) {
        room.music = { ...room.music, playing: !!playing, timestamp: Date.now() };
        io.to(currentRoom).emit('music-update', room.music);
      }
    });

    // Generic patch for future needs (seek position, track metadata, etc.)
    socket.on('update-music', async (data) => {
      if (!currentRoom || !currentUser?.isHost) return;
      const room = await roomService.getRoomByCode(currentRoom);
      if (room) {
        room.music = { ...room.music, ...data, timestamp: Date.now() };
        io.to(currentRoom).emit('music-update', room.music);
      }
    });

    // Explicit, host-only "End Conversation". This is intentionally separate
    // from the disconnect grace window below — an explicit end must be
    // immediate, not wait 20s in case the host "reconnects" (they didn't
    // disconnect, they clicked a button).
    socket.on('end-room', async (_data, callback) => {
      if (!currentRoom || !currentUser) {
        if (callback) callback({ error: 'Not connected to a room' });
        return;
      }
      if (!currentUser.isHost) {
        if (callback) callback({ error: 'Only the host can end this conversation.' });
        return;
      }

      const room = await roomService.getRoomByCode(currentRoom);
      if (!room) {
        if (callback) callback({ error: 'Room not found' });
        return;
      }

      // Cancel any stray grace-window timers so they don't fire later against
      // a room we're about to delete.
      if (room.pendingDisconnects) {
        for (const { timeout } of room.pendingDisconnects.values()) clearTimeout(timeout);
        room.pendingDisconnects.clear();
      }

      io.to(currentRoom).emit('room-closed', { endedBy: 'host' });
      io.in(currentRoom).socketsJoin('closed-room');
      io.sockets.in(currentRoom).disconnectSockets(true);
      await roomService.deleteRoom(currentRoom);

      if (callback) callback({ success: true });
    });

    // Explicit, visitor-initiated leave. Distinct from a network disconnect —
    // this skips the grace window so the host isn't shown a false
    // "reconnecting..." indicator for someone who left on purpose.
    socket.on('leave-room', async () => {
      if (!currentRoom || !currentUser || currentUser.isHost) return;

      const room = await roomService.getRoomByCode(currentRoom);
      if (room) {
        const pending = room.pendingDisconnects?.get(currentUser.nickname);
        if (pending) {
          clearTimeout(pending.timeout);
          room.pendingDisconnects.delete(currentUser.nickname);
        }

        room.members.delete(socket.id);
        io.to(currentRoom).emit('user-left', currentUser.id);
        io.to(currentRoom).emit('online-count', room.members.size);
        if (room.members.size === 0) {
          room.emptySince = Date.now();
        }
      }

      // Clear local state so the 'disconnect' handler below (which fires
      // right after socket.disconnect() on the client) treats this as
      // already-handled and does nothing further.
      currentRoom = null;
      currentUser = null;
    });

    socket.on('disconnect', async () => {
      if (currentRoom && currentUser) {
        const room = await roomService.getRoomByCode(currentRoom);
        if (room) {
          // Remove this socket's entry right away — the member list reflects
          // "currently connected sockets" — but DON'T end the room / drop the
          // user from the conversation yet. Give them a grace window to
          // reconnect (same nickname) before we treat it as a real departure.
          room.members.delete(socket.id);
          socket.to(currentRoom).emit('user-disconnected', {
            userId: currentUser.id,
            nickname: currentUser.nickname,
            isHost: currentUser.isHost
          });
          io.to(currentRoom).emit('online-count', room.members.size);

          if (!room.pendingDisconnects) room.pendingDisconnects = new Map();

          const graceMs = currentRoom === 'DEMO12' ? 0 : RECONNECT_GRACE_MS;
          const { nickname, isHost } = currentUser;
          const roomCode = currentRoom;

          const timeout = setTimeout(async () => {
            // If they reconnected in the meantime, join-room already cleared
            // this entry — so if we're still here, it's a real departure.
            room.pendingDisconnects.delete(nickname);

            if (isHost && roomCode !== 'DEMO12') {
              io.to(roomCode).emit('room-closed');
              io.in(roomCode).socketsJoin('closed-room');
              io.sockets.in(roomCode).disconnectSockets(true);
              await roomService.deleteRoom(roomCode);
            } else {
              io.to(roomCode).emit('user-left', currentUser.id);
              if (room.members.size === 0) {
                room.emptySince = Date.now();
              }
            }
          }, graceMs);

          room.pendingDisconnects.set(nickname, { isHost, timeout });
        }
      }
      lastMessageTimes.delete(socket.id);
    });
  });
}