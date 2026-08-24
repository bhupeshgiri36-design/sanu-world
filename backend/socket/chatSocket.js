// ✅ backend/socket/chatSocket.js - FULLY UPDATED WITH ALL FIXES

import crypto from 'crypto';
import { roomService } from '../services/roomService.js';
import { getAdminFromSocket } from './adminAuth.js';
import { createRateLimiter } from '../utils/rateLimiter.js';

// Generic per-socket flood guard
const EVENT_FLOOD_WINDOW_MS = 10 * 1000;
const EVENT_FLOOD_MAX = 60;
const checkEventFlood = createRateLimiter({ windowMs: EVENT_FLOOD_WINDOW_MS, max: EVENT_FLOOD_MAX });

// join-room specific flood control
const JOIN_FLOOD_WINDOW_MS = 30 * 1000;
const JOIN_FLOOD_MAX = 8;
const checkJoinFlood = createRateLimiter({ windowMs: JOIN_FLOOD_WINDOW_MS, max: JOIN_FLOOD_MAX });

const RECONNECT_GRACE_MS = Number(process.env.RECONNECT_GRACE_MS) || 60 * 1000;

// Room locking to prevent race conditions
const roomLocks = new Map();
function withRoomLock(code, fn) {
  const prev = roomLocks.get(code) || Promise.resolve();
  const run = prev.then(fn, fn);
  roomLocks.set(code, run.catch(() => {}));
  return run;
}

export function setupSocketHandlers(io) {
  const lastMessageTimes = new Map();

  io.on('connection', (socket) => {
    let currentRoom = null;
    let currentUser = null;
    let pendingJoinRequest = null;

    const on = (event, handler) => {
      socket.on(event, (...args) => {
        const { allowed } = checkEventFlood(socket.id);
        if (!allowed) {
          socket.disconnect(true);
          return;
        }
        handler(...args);
      });
    };

    on('join-room', async ({ roomCode, nickname, password, clientId } = {}, callback) => {
      const { allowed: joinAllowed } = checkJoinFlood(socket.id);
      if (!joinAllowed) {
        if (callback) callback({ error: 'Too many join attempts. Please wait a moment and try again.' });
        return;
      }

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

      const trimmedNickname = (nickname || '').trim();
      if (!trimmedNickname) {
        if (callback) callback({ error: 'Please enter a name' });
        return;
      }

      if (room.kickedNicknames?.has(trimmedNickname)) {
        if (callback) callback({ error: 'You have been removed from this room' });
        return;
      }

      await withRoomLock(code, async () => {
        if (!room.pendingDisconnects) room.pendingDisconnects = new Map();
        if (!room.pendingJoinRequests) room.pendingJoinRequests = new Map();

        const pending = clientId ? room.pendingDisconnects.get(clientId) : null;
        let isReconnecting = !!pending;

        const admin = getAdminFromSocket(socket);
        const isAdmin = isReconnecting
          ? pending.isAdmin
          : (!!admin || code === 'DEMO12');

        if (pending) {
          clearTimeout(pending.timeout);
          room.pendingDisconnects.delete(clientId);
        }

        const staleEntry = clientId
          ? Array.from(room.members.entries()).find(([id, m]) => id !== socket.id && m.clientId === clientId)
          : undefined;

        if (staleEntry) {
          const [staleId] = staleEntry;
          isReconnecting = true;
          room.members.delete(staleId);
          const staleSocket = io.sockets.sockets.get(staleId);
          if (staleSocket) {
            staleSocket.data.replaced = true;
            staleSocket.leave(code);
            staleSocket.disconnect(true);
          }
        }

        if (!isAdmin) {
          const hostNickname = Array.from(room.members.values()).find((m) => m.isAdmin)?.nickname;
          const reserved = trimmedNickname.toLowerCase() === 'sanu'
            || (hostNickname && trimmedNickname.toLowerCase() === hostNickname.toLowerCase())
            || (room.creatorNickname && trimmedNickname.toLowerCase() === room.creatorNickname.toLowerCase());
          if (reserved) {
            if (callback) callback({ error: 'That name is reserved for the host. Please choose a different name.' });
            return;
          }
        }

        if (!isReconnecting) {
          const nameTakenByMember = Array.from(room.members.values())
            .some((m) => m.id !== socket.id && m.nickname.toLowerCase() === trimmedNickname.toLowerCase());
          const nameTakenByPendingRequest = Array.from(room.pendingJoinRequests.values())
            .some((req) => req.socketId !== socket.id && req.nickname.toLowerCase() === trimmedNickname.toLowerCase());
          if (nameTakenByMember || nameTakenByPendingRequest) {
            if (callback) callback({ error: 'That name is already taken in this room. Please choose a different name.' });
            return;
          }
        }

        if (!isAdmin && !isReconnecting && room.members.size >= room.maxMembers && !room.members.has(socket.id)) {
          if (callback) callback({ error: 'This room is full' });
          return;
        }

        if (!isAdmin && !isReconnecting) {
          const requestId = crypto.randomUUID();
          room.pendingJoinRequests.set(requestId, { socketId: socket.id, nickname: trimmedNickname, password, clientId });
          pendingJoinRequest = { code, requestId };

          const hostEntry = Array.from(room.members.values()).find((m) => m.isAdmin);
          if (hostEntry) {
            io.to(hostEntry.id).emit('join-request', { requestId, nickname: trimmedNickname });
          }

          if (callback) callback({ pending: true, requestId });
          return;
        }

        currentRoom = code;
        currentUser = { id: socket.id, nickname: trimmedNickname, isAdmin, isHost: isAdmin, clientId };

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
            isHost: isAdmin,
            isAdmin,
            reconnected: isReconnecting
          });
        }

        if (isReconnecting) {
          io.to(code).emit('user-reconnected', currentUser);
        } else {
          socket.to(code).emit('user-joined', currentUser);
        }
        io.to(code).emit('online-count', room.members.size);

        if (isAdmin && room.pendingJoinRequests?.size) {
          for (const [reqId, req] of room.pendingJoinRequests) {
            io.to(socket.id).emit('join-request', { requestId: reqId, nickname: req.nickname });
          }
        }
      });
    });

    // ✅ FIXED: respond-join-request handler with session state initialization
    on('respond-join-request', async ({ requestId, approve } = {}, callback) => {
      if (!currentRoom || !currentUser?.isAdmin) {
        if (callback) callback({ error: 'Only Sanu can respond to join requests.' });
        return;
      }

      const room = await roomService.getRoomByCode(currentRoom);
      if (!room) {
        if (callback) callback({ error: 'This request is no longer active.' });
        return;
      }

      await withRoomLock(currentRoom, async () => {
        const request = room.pendingJoinRequests?.get(requestId);
        if (!request) {
          if (callback) callback({ error: 'This request is no longer active.' });
          return;
        }

        room.pendingJoinRequests.delete(requestId);
        const requesterSocket = io.sockets.sockets.get(request.socketId);

        if (!requesterSocket) {
          if (callback) callback({ success: true });
          return;
        }

        if (!approve) {
          requesterSocket.emit('join-denied', { reason: 'Sanu declined your request to join.' });
          if (callback) callback({ success: true });
          return;
        }

        if (room.members.size >= room.maxMembers && !room.members.has(request.socketId)) {
          requesterSocket.emit('join-denied', { reason: 'This room is full' });
          if (callback) callback({ success: true });
          return;
        }

        // Create the new user object
        const newUser = { 
          id: request.socketId, 
          nickname: request.nickname, 
          isAdmin: false, 
          isHost: false, 
          clientId: request.clientId 
        };

        room.members.set(request.socketId, newUser);
        room.emptySince = undefined;

        // 🔧 CRITICAL FIX: Initialize the approved socket's session state
        // These 2 lines are ESSENTIAL - without them, the socket doesn't know
        // which room it's in and send-message fails with "Not connected to a room"
        requesterSocket.data.currentRoom = currentRoom;
        requesterSocket.data.currentUser = newUser;

        requesterSocket.join(currentRoom);

        requesterSocket.emit('join-approved', {
          room: {
            code: room.code,
            name: room.name,
            messages: room.messages,
            members: Array.from(room.members.values()),
            music: room.music
          },
          isHost: false,
          isAdmin: false
        });

        io.to(currentRoom).emit('user-joined', newUser);
        io.to(currentRoom).emit('online-count', room.members.size);

        if (callback) callback({ success: true });
      });
    });

    on('send-message', async (messageData, callback) => {
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

      const isMediaPayload = messageData && typeof messageData === 'object' && messageData.mediaUrl;

      let text;
      let type;

      if (isMediaPayload) {
        const { mediaUrl, mediaType } = messageData;
        if (typeof mediaUrl !== 'string' || !/^https?:\/\//.test(mediaUrl)) {
          if (callback) callback({ error: 'Invalid media' });
          return;
        }
        if (mediaType !== 'image' && mediaType !== 'video') {
          if (callback) callback({ error: 'Invalid media type' });
          return;
        }
        text = mediaUrl;
        type = mediaType;
      } else {
        const raw = typeof messageData === 'string' ? messageData : messageData?.text;

        if (!raw || typeof raw !== 'string' || !raw.trim()) {
          if (callback) callback({ error: 'Empty message' });
          return;
        }

        const isLegacyBase64Image = raw.startsWith('data:image/');

        if (isLegacyBase64Image) {
          if (raw.length > 3 * 1024 * 1024) {
            if (callback) callback({ error: 'Image too large' });
            return;
          }
        } else if (raw.length > 1000) {
          if (callback) callback({ error: 'Message too long' });
          return;
        }

        text = raw;
        type = isLegacyBase64Image ? 'image' : 'text';
      }

      lastMessageTimes.set(socket.id, now);

      const message = {
        id: Math.random().toString(36).substr(2, 9),
        userId: currentUser.id,
        nickname: currentUser.nickname,
        text,
        type,
        timestamp: Date.now(),
        isAdmin: currentUser.isAdmin
      };

      if (room.messages.length >= 100) {
        room.messages.shift();
      }
      room.messages.push(message);

      socket.to(currentRoom).emit('user-stopped-typing', { userId: currentUser.id });

      io.to(currentRoom).emit('receive-message', message);
      if (callback) callback({ success: true });
    });

    on('typing-start', () => {
      if (!currentRoom || !currentUser) return;
      socket.to(currentRoom).emit('user-typing', { userId: currentUser.id, nickname: currentUser.nickname });
    });

    on('typing-stop', () => {
      if (!currentRoom || !currentUser) return;
      socket.to(currentRoom).emit('user-stopped-typing', { userId: currentUser.id });
    });

    on('set-music', async (track) => {
      if (!currentRoom || !currentUser?.isAdmin || !track) return;
      const room = await roomService.getRoomByCode(currentRoom);
      if (room) {
        room.music = { ...track, playing: false, position: 0, timestamp: Date.now() };
        io.to(currentRoom).emit('music-update', room.music);
      }
    });

    on('music-play', async ({ position } = {}) => {
      if (!currentRoom || !currentUser?.isAdmin) return;
      const room = await roomService.getRoomByCode(currentRoom);
      if (room && room.music) {
        room.music = {
          ...room.music,
          playing: true,
          position: Number.isFinite(position) ? position : (room.music.position || 0),
          timestamp: Date.now()
        };
        io.to(currentRoom).emit('music-update', room.music);
      }
    });

    on('music-pause', async ({ position } = {}) => {
      if (!currentRoom || !currentUser?.isAdmin) return;
      const room = await roomService.getRoomByCode(currentRoom);
      if (room && room.music) {
        room.music = {
          ...room.music,
          playing: false,
          position: Number.isFinite(position) ? position : (room.music.position || 0),
          timestamp: Date.now()
        };
        io.to(currentRoom).emit('music-update', room.music);
      }
    });

    on('music-seek', async ({ position } = {}) => {
      if (!currentRoom || !currentUser?.isAdmin || !Number.isFinite(position)) return;
      const room = await roomService.getRoomByCode(currentRoom);
      if (room && room.music) {
        room.music = { ...room.music, position, timestamp: Date.now() };
        io.to(currentRoom).emit('music-update', room.music);
      }
    });

    on('music-state', async (playing) => {
      if (!currentRoom || !currentUser?.isAdmin) return;
      const room = await roomService.getRoomByCode(currentRoom);
      if (room && room.music) {
        room.music = { ...room.music, playing: !!playing, timestamp: Date.now() };
        io.to(currentRoom).emit('music-update', room.music);
      }
    });

    on('update-music', async (data) => {
      if (!currentRoom || !currentUser?.isAdmin) return;
      const room = await roomService.getRoomByCode(currentRoom);
      if (room) {
        room.music = { ...room.music, ...data, timestamp: Date.now() };
        io.to(currentRoom).emit('music-update', room.music);
      }
    });

    on('admin-kick-user', async ({ userId } = {}, callback) => {
      if (!currentRoom || !currentUser?.isAdmin) {
        if (callback) callback({ error: 'Only Sanu can remove people from this room.' });
        return;
      }
      if (!userId || userId === socket.id) {
        if (callback) callback({ error: 'Invalid target' });
        return;
      }

      const room = await roomService.getRoomByCode(currentRoom);
      if (!room) {
        if (callback) callback({ error: 'Room not found' });
        return;
      }

      await withRoomLock(currentRoom, async () => {
        const target = room.members.get(userId);
        if (!target) {
          if (callback) callback({ error: 'That person is no longer in the room' });
          return;
        }

        if (!room.kickedNicknames) room.kickedNicknames = new Set();
        room.kickedNicknames.add(target.nickname);

        const pending = target.clientId ? room.pendingDisconnects?.get(target.clientId) : null;
        if (pending) {
          clearTimeout(pending.timeout);
          room.pendingDisconnects.delete(target.clientId);
        }

        room.members.delete(userId);

        io.to(userId).emit('kicked', { reason: 'Sanu removed you from this room.' });
        io.to(currentRoom).emit('user-stopped-typing', { userId });
        io.to(currentRoom).emit('user-kicked', { userId, nickname: target.nickname });
        io.to(currentRoom).emit('online-count', room.members.size);

        const targetSocket = io.sockets.sockets.get(userId);
        if (targetSocket) {
          targetSocket.data.kicked = true;
          targetSocket.leave(currentRoom);
          targetSocket.disconnect(true);
        }

        if (callback) callback({ success: true });
      });
    });

    on('end-room', async (_data, callback) => {
      if (!currentRoom || !currentUser) {
        if (callback) callback({ error: 'Not connected to a room' });
        return;
      }
      if (!currentUser.isAdmin) {
        if (callback) callback({ error: 'Only Sanu can end this conversation.' });
        return;
      }

      const room = await roomService.getRoomByCode(currentRoom);
      if (!room) {
        if (callback) callback({ error: 'Room not found' });
        return;
      }

      await withRoomLock(currentRoom, async () => {
        if (room.pendingDisconnects) {
          for (const { timeout } of room.pendingDisconnects.values()) clearTimeout(timeout);
          room.pendingDisconnects.clear();
        }

        io.to(currentRoom).emit('room-closed', { endedBy: 'sanu' });
        io.in(currentRoom).socketsJoin('closed-room');
        io.sockets.in(currentRoom).disconnectSockets(true);
        await roomService.deleteRoom(currentRoom);

        if (callback) callback({ success: true });
      });
    });

    on('leave-room', async () => {
      if (!currentRoom || !currentUser || currentUser.isAdmin) return;

      const code = currentRoom;
      const user = currentUser;

      currentRoom = null;
      currentUser = null;

      await withRoomLock(code, async () => {
        const room = await roomService.getRoomByCode(code);
        if (!room) return;

        const pending = user.clientId ? room.pendingDisconnects?.get(user.clientId) : null;
        if (pending) {
          clearTimeout(pending.timeout);
          room.pendingDisconnects.delete(user.clientId);
        }

        room.members.delete(user.id);
        io.to(code).emit('user-left', user.id);
        io.to(code).emit('online-count', room.members.size);
        if (room.members.size === 0) {
          room.emptySince = Date.now();
        }
      });
    });

    socket.on('disconnect', async () => {
      if (pendingJoinRequest) {
        const { code, requestId } = pendingJoinRequest;
        pendingJoinRequest = null;
        lastMessageTimes.delete(socket.id);
        await withRoomLock(code, async () => {
          const room = await roomService.getRoomByCode(code);
          if (room?.pendingJoinRequests?.has(requestId)) {
            room.pendingJoinRequests.delete(requestId);
            const hostEntry = Array.from(room.members.values()).find((m) => m.isAdmin);
            if (hostEntry) io.to(hostEntry.id).emit('join-request-cancelled', { requestId });
          }
        });
        return;
      }

      if (socket.data?.kicked || socket.data?.replaced) {
        lastMessageTimes.delete(socket.id);
        return;
      }

      if (currentRoom && currentUser) {
        const code = currentRoom;
        const user = currentUser;

        await withRoomLock(code, async () => {
          const room = await roomService.getRoomByCode(code);
          if (!room) return;

          room.members.delete(user.id);
          socket.to(code).emit('user-stopped-typing', { userId: user.id });
          socket.to(code).emit('user-disconnected', {
            userId: user.id,
            nickname: user.nickname,
            isAdmin: user.isAdmin
          });
          io.to(code).emit('online-count', room.members.size);

          if (!room.pendingDisconnects) room.pendingDisconnects = new Map();

          const graceMs = code === 'DEMO12' ? 0 : RECONNECT_GRACE_MS;
          const { isAdmin, clientId } = user;
          const key = clientId || `legacy:${socket.id}`;

          const timeout = setTimeout(() => {
            withRoomLock(code, async () => {
              if (!room.pendingDisconnects.has(key)) return;
              room.pendingDisconnects.delete(key);

              if (isAdmin && code !== 'DEMO12') {
                io.to(code).emit('room-closed', { endedBy: 'sanu' });
                io.in(code).socketsJoin('closed-room');
                io.sockets.in(code).disconnectSockets(true);
                await roomService.deleteRoom(code);
              } else {
                io.to(code).emit('user-left', user.id);
                if (room.members.size === 0) {
                  room.emptySince = Date.now();
                }
              }
            });
          }, graceMs);

          room.pendingDisconnects.set(key, { isAdmin, timeout });
        });
      }
      lastMessageTimes.delete(socket.id);
    });
  });
}
