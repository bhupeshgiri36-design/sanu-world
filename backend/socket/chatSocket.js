// backend/socket/chatSocket.js

import crypto from 'crypto';
import { roomService } from '../services/roomService.js';
import { getAdminFromSocket } from './adminAuth.js';
import { createRateLimiter } from '../utils/rateLimiter.js';

// Generic per-socket flood guard. Wraps every `socket.on(event, handler)`
// call below so a client spamming ANY event (join-room, typing, kicks,
// whatever) gets cut off instead of hammering the room lock / DB on every
// tick. This is deliberately generous (events are normal, human-paced
// interaction) — it's meant to catch scripted abuse, not throttle real use.
const EVENT_FLOOD_WINDOW_MS = 10 * 1000;
const EVENT_FLOOD_MAX = 60; // 60 events / 10s per socket, any mix of events
const checkEventFlood = createRateLimiter({ windowMs: EVENT_FLOOD_WINDOW_MS, max: EVENT_FLOOD_MAX });

// join-room specifically gets its own, tighter budget — this is the event
// someone would use to brute-force room codes/passwords or spam join
// requests at Sanu.
const JOIN_FLOOD_WINDOW_MS = 30 * 1000;
const JOIN_FLOOD_MAX = 8;
const checkJoinFlood = createRateLimiter({ windowMs: JOIN_FLOOD_WINDOW_MS, max: JOIN_FLOOD_MAX });

// How long a disconnected participant has to reconnect before we treat it
// as a real departure. Host disconnect => room would otherwise be destroyed
// instantly; visitor disconnect => they'd otherwise be dropped from the
// member list instantly. A brief wifi drop or backgrounded tab shouldn't end
// the conversation.
//
// IMPORTANT: if this backend runs somewhere that can "cold start" (e.g. a
// free Render web service spinning down after inactivity), a page reload
// can easily take 30-60s to actually reach the server again. If this value
// is shorter than that, the host's own reload will lose the race against
// this timer — the room gets deleted before their reconnect even arrives,
// which looks like "reloading kicks me to the home page". Keep this
// comfortably above your platform's worst-case cold-start time, or set
// RECONNECT_GRACE_MS in your environment.
const RECONNECT_GRACE_MS = Number(process.env.RECONNECT_GRACE_MS) || 60 * 1000;

// Every handler below does `await roomService.getRoomByCode(...)`, which
// yields the event loop. That means a 'disconnect' and the 'join-room' that
// reconnects it (or a kick, or another join) can interleave and corrupt
// room.members — duplicate entries, false "room full", lost cleanup. This
// queues the mutating part of each handler so operations on the same room
// always finish in the order they arrived.
const roomLocks = new Map();
function withRoomLock(code, fn) {
  const prev = roomLocks.get(code) || Promise.resolve();
  const run = prev.then(fn, fn);
  roomLocks.set(code, run.catch(() => {})); // never let one failure jam the queue
  return run;
}

export function setupSocketHandlers(io) {
  const lastMessageTimes = new Map();

  io.on('connection', (socket) => {
    let currentRoom = null;
    let currentUser = null;
    // Set only while this socket is sitting in a room's approval queue
    // (i.e. it asked to join but Sanu hasn't approved/denied yet). Used to
    // clean the request up if they close the tab before getting an answer.
    let pendingJoinRequest = null;

    // Every handler below is registered through `on(...)` instead of
    // `socket.on(...)` directly (except 'disconnect', which must always
    // run so cleanup can't be starved) so a client spamming events gets
    // disconnected instead of hammering the room lock indefinitely.
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

      // A friend who was kicked from this room, or removed via room reset,
      // must not be able to walk back in on the old link/nickname — even
      // if other people can still join fine.
      if (room.kickedNicknames?.has(trimmedNickname)) {
        if (callback) callback({ error: 'You have been removed from this room' });
        return;
      }

      await withRoomLock(code, async () => {
        if (!room.pendingDisconnects) room.pendingDisconnects = new Map();
        if (!room.pendingJoinRequests) room.pendingJoinRequests = new Map();

        // A reconnect gets a NEW socket.id, so we match it back to its old
        // session by `clientId` — a random id the frontend generates once
        // per tab/session and persists in sessionStorage (see ChatRoom.jsx).
        // This used to be matched by nickname, which meant two different
        // people who happened to type the same name could knock each other
        // off the room — this fixes that.
        const pending = clientId ? room.pendingDisconnects.get(clientId) : null;
        let isReconnecting = !!pending;

        // Sanu's admin identity is verified from the admin_token cookie set by
        // /api/admin/login (the same session used for the dashboard) — never
        // from the nickname the person typed. Anyone typing "Sanu" as their
        // nickname is still just a friend.
        const admin = getAdminFromSocket(socket);
        const isAdmin = isReconnecting
          ? pending.isAdmin
          : !!admin;

        if (pending) {
          clearTimeout(pending.timeout);
          room.pendingDisconnects.delete(clientId);
        }

        // A live old socket for this exact same session may still be
        // sitting in room.members — e.g. the client's own auto-reconnect
        // fired before the old socket's 'disconnect' handler (below)
        // finished running. Matched by clientId (not nickname/isAdmin), so
        // this only ever fires for the SAME browser tab reconnecting, never
        // for a different person who typed the same name.
        const staleEntry = clientId
          ? Array.from(room.members.entries()).find(([id, m]) => id !== socket.id && m.clientId === clientId)
          : undefined;

        if (staleEntry) {
          const [staleId] = staleEntry;
          isReconnecting = true;
          room.members.delete(staleId);
          const staleSocket = io.sockets.sockets.get(staleId);
          if (staleSocket) {
            // Tell its own 'disconnect' handler that cleanup already
            // happened here, so it doesn't also start a grace timer or emit
            // duplicate departure events for a connection we just replaced.
            staleSocket.data.replaced = true;
            staleSocket.leave(code);
            staleSocket.disconnect(true);
          }
        }

        // Nobody — friend or otherwise — gets to walk in under Sanu's name.
        // Checked against the literal word "sanu" and whatever nickname the
        // room's actual host is using right now, so a friend can't
        // impersonate the host in the member list or chat.
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

        // Two different friends can't hold the same name at the same time
        // either — beyond just being confusing in the member list, the old
        // reconnect-matching logic used to treat "same nickname" as "same
        // person" and would silently disconnect whoever was already using
        // it. Checked against both active members AND anyone else still
        // sitting in the approval queue (otherwise two people could queue
        // up with the same name and both get approved). Reconnecting
        // sessions (matched above by clientId) are exempt.
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

        // A friend who isn't just reconnecting (grace window elapsed, or they
        // deliberately left and tapped the link again) doesn't walk straight
        // in — Sanu has to approve them first. Admin joins skip this entirely.
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

        // Sanu just (re)joined the room — replay anyone who's been sitting in
        // the approval queue so their request isn't silently lost.
        if (isAdmin && room.pendingJoinRequests?.size) {
          for (const [reqId, req] of room.pendingJoinRequests) {
            io.to(socket.id).emit('join-request', { requestId: reqId, nickname: req.nickname });
          }
        }
      });
    });

    // Sanu approves or denies someone waiting in the room's approval queue.
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
          // They already closed the tab / disconnected while waiting.
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

        const newUser = { id: request.socketId, nickname: request.nickname, isAdmin: false, isHost: false, clientId: request.clientId };
        room.members.set(request.socketId, newUser);
        room.emptySince = undefined;
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

    // Frontend sends one of:
    //  - a plain text string
    //  - a legacy base64 image data-URL string (small images, old clients)
    //  - { mediaUrl, mediaType } for an already-uploaded image/video (see
    //    /api/media/upload) — this is the normal path now, since sending
    //    video (or even a decent-sized photo) as base64 over the socket
    //    isn't workable.
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
        // Accept either a raw string or a { text } object, but never trust the shape blindly.
        const raw = typeof messageData === 'string' ? messageData : messageData?.text;

        if (!raw || typeof raw !== 'string' || !raw.trim()) {
          if (callback) callback({ error: 'Empty message' });
          return;
        }

        const isLegacyBase64Image = raw.startsWith('data:image/');

        if (isLegacyBase64Image) {
          // ~2MB image -> base64 is ~2.7MB of text; give some headroom.
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

      // The message is always attributed to whoever's socket actually sent
      // it (currentUser, resolved from THIS connection) — never to Sanu just
      // because Sanu happens to be the admin. A friend's uploaded photo
      // stays the friend's message.
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

      // Sender stops "typing" the moment a message actually lands.
      socket.to(currentRoom).emit('user-stopped-typing', { userId: currentUser.id });

      io.to(currentRoom).emit('receive-message', message);
      if (callback) callback({ success: true });
    });

    // Typing indicator. Purely ephemeral — never stored, just relayed to
    // everyone else in the room while the sender has text in the box.
    on('typing-start', () => {
      if (!currentRoom || !currentUser) return;
      socket.to(currentRoom).emit('user-typing', { userId: currentUser.id, nickname: currentUser.nickname });
    });

    on('typing-stop', () => {
      if (!currentRoom || !currentUser) return;
      socket.to(currentRoom).emit('user-stopped-typing', { userId: currentUser.id });
    });

    // Sanu picks a new track (full track object from search: id, title,
    // artist, streamUrl, artwork...). Broadcast to everyone, including
    // Sanu, so the friend's "Now Playing" bar updates too. Friends never
    // reach this — the search UI itself is admin-only on the frontend —
    // but we still gate it here since the client can't be trusted.
    on('set-music', async (track) => {
      if (!currentRoom || !currentUser?.isAdmin || !track) return;
      const room = await roomService.getRoomByCode(currentRoom);
      if (room) {
        // Don't force autoplay on either side — browsers block unsolicited
        // playback anyway. Sanu presses play explicitly (music-play below),
        // and that's what starts the synced clock.
        room.music = { ...track, playing: false, position: 0, timestamp: Date.now() };
        io.to(currentRoom).emit('music-update', room.music);
      }
    });

    // Sanu is the only one who drives playback. Everything below stamps
    // `position` (seconds into the track) + `timestamp` (server time it was
    // true) so the friend's client can compute "where the track should be
    // right now" — position + elapsed-since-timestamp while playing — and
    // stay in sync without a constant stream of updates.
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

    // Kept for backwards compatibility with older clients.
    on('music-state', async (playing) => {
      if (!currentRoom || !currentUser?.isAdmin) return;
      const room = await roomService.getRoomByCode(currentRoom);
      if (room && room.music) {
        room.music = { ...room.music, playing: !!playing, timestamp: Date.now() };
        io.to(currentRoom).emit('music-update', room.music);
      }
    });

    // Generic patch for future needs (track metadata, etc.)
    on('update-music', async (data) => {
      if (!currentRoom || !currentUser?.isAdmin) return;
      const room = await roomService.getRoomByCode(currentRoom);
      if (room) {
        room.music = { ...room.music, ...data, timestamp: Date.now() };
        io.to(currentRoom).emit('music-update', room.music);
      }
    });

    // Sanu removes one friend from the room. Sanu stays connected and in
    // the room — only the target socket is disconnected. The target's
    // nickname is remembered as "kicked" so they can't rejoin via the same
    // link, while everyone else can still join normally.
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

        // Cancel any reconnect-grace timer for them so it doesn't fire later
        // and double-announce their departure.
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
          // Tell their own 'disconnect' handler that room cleanup was
          // already done here, so it doesn't also start a reconnect-grace
          // timer or emit duplicate departure events for them.
          targetSocket.data.kicked = true;
          targetSocket.leave(currentRoom);
          targetSocket.disconnect(true);
        }

        if (callback) callback({ success: true });
      });
    });

    // Explicit, host-only "End Conversation". This is intentionally separate
    // from the disconnect grace window below — an explicit end must be
    // immediate, not wait for a reconnect that isn't coming (they didn't
    // disconnect, they clicked a button).
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
        // Cancel any stray grace-window timers so they don't fire later against
        // a room we're about to delete.
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

    // Explicit, visitor-initiated leave. Distinct from a network disconnect —
    // this skips the grace window so the host isn't shown a false
    // "reconnecting..." indicator for someone who left on purpose.
    on('leave-room', async () => {
      if (!currentRoom || !currentUser || currentUser.isAdmin) return;

      const code = currentRoom;
      const user = currentUser;

      // Clear local state right away so the 'disconnect' handler below
      // (which fires right after socket.disconnect() on the client) treats
      // this as already-handled and does nothing further.
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
      // They were still waiting on Sanu to approve/deny — pull their
      // request out of the queue and let Sanu know it's gone.
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

      // admin-kick-user, or a fresher reconnect handled inside join-room,
      // already did all the room bookkeeping for this socket — don't redo
      // it here or start a pointless reconnect-grace timer for a
      // connection we intentionally pushed out.
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

          // Remove this socket's entry right away — the member list reflects
          // "currently connected sockets" — but DON'T end the room / drop the
          // user from the conversation yet. Give them a grace window to
          // reconnect (same session) before we treat it as a real departure.
          room.members.delete(user.id);
          socket.to(code).emit('user-stopped-typing', { userId: user.id });
          socket.to(code).emit('user-disconnected', {
            userId: user.id,
            nickname: user.nickname,
            isAdmin: user.isAdmin
          });
          io.to(code).emit('online-count', room.members.size);

          if (!room.pendingDisconnects) room.pendingDisconnects = new Map();

          const { isAdmin, clientId } = user;
          // Sockets from clients that haven't been redeployed with the
          // clientId change yet fall back to a synthetic per-socket key —
          // they just won't get reconnect-grace matching, same as before.
          const key = clientId || `legacy:${socket.id}`;

          const timeout = setTimeout(() => {
            withRoomLock(code, async () => {
              // If they reconnected in the meantime, join-room already
              // cleared this entry — so if we're still here, it's real.
              if (!room.pendingDisconnects.has(key)) return;
              room.pendingDisconnects.delete(key);

              if (isAdmin) {
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
          }, RECONNECT_GRACE_MS);

          room.pendingDisconnects.set(key, { isAdmin, timeout });
        });
      }
      lastMessageTimes.delete(socket.id);
    });
  });
}
