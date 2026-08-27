// frontend/src/components/ChatRoom.jsx

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSocket } from '../lib/socket';
import { Send, Users, LogOut, Share2, Menu, X, CheckCircle2, Image as ImageIcon, Music, Heart, MessageSquare, Crown, UserX, ChevronDown, ChevronUp, Loader2, Trash2, CornerUpLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import TopAd from './ads/TopAd';
import BottomAd from './ads/BottomAd';
import SideAd from './ads/SideAd';
import ChatBottomAd from './ads/ChatBottomAd';
import NativeAd from './ads/NativeAd';
import SkyscraperAd from './ads/SkyscraperAd';
import MusicSearch from './music/MusicSearch';
import MusicPlayer from './music/MusicPlayer';
import { adminFetch, uploadMedia } from '../lib/api';
import { useIsAdmin } from '../context/AdminContext';
import useKeyboardOpen from '../hooks/useKeyboardOpen';

// How long after the last keystroke we tell the room "stopped typing" if no
// further typing or send happens.
const TYPING_STOP_DELAY_MS = 2500;

// How long a message is allowed to sit in the "waiting for the socket to be
// ready" queue before we give up waiting silently and tell the user it
// hasn't gone anywhere. Without this, a message queued while isReadyRef was
// false could sit forever with zero feedback if the expected reconnect ack
// never arrived (e.g. it landed as `pending` instead of a normal join, or
// the connect event fired without actually restoring readiness).
const SEND_QUEUE_TIMEOUT_MS = 5000;

// Merge a fresh member (from 'user-joined' / 'user-reconnected' / the
// initial join ack) into a members array, replacing any stale entry for the
// same person instead of appending a duplicate. We treat "same person" as
// same socket id OR same nickname — a reconnect always gets a new socket
// id, so id-only matching would leave the old row behind forever.
function mergeMember(members, user) {
  if (!user) return members;
  const withoutStale = members.filter((m) => m.id !== user.id && m.nickname !== user.nickname);
  return [...withoutStale, user];
}

// A random id generated once per tab/session and persisted in
// sessionStorage for the lifetime of that tab in this room. The server
// uses this (not the nickname) to recognize "this is the same person
// reconnecting" — matching by nickname used to mean two different people
// who typed the same name could knock each other offline.
function getOrCreateClientId(roomCode) {
  const key = `room_${roomCode}_clientId`;
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = (window.crypto?.randomUUID)
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(key, id);
  }
  return id;
}

export default function ChatRoom() {
  const { code } = useParams();
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null); // { id, nickname, text, type } | null
  const [clearingHistory, setClearingHistory] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [showSidebar, setShowSidebar] = useState(false);
  const [copied, setCopied] = useState(false);

  // Join state
  const [joinStep, setJoinStep] = useState('checking'); // 'checking' | 'intro' | 'form' | 'pending' | 'joined' | 'error'
  const [roomInfo, setRoomInfo] = useState(null);
  const [isHost, setIsHost] = useState(false);

  // Friends don't walk straight into the room anymore — Sanu has to
  // approve them. `joinRequests` (host-side) is the queue of people
  // currently waiting on Sanu's decision.
  const [joinRequests, setJoinRequests] = useState([]);

  const [joinNickname, setJoinNickname] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const [connectionStatus, setConnectionStatus] = useState('connected'); // 'connected' | 'reconnecting'
  const [peerStatus, setPeerStatus] = useState(null); // null | { nickname, isAdmin }
  const hasJoinedRef = useRef(false);
  const isHostRef = useRef(false);

  // True only once we've got a confirmed, current 'join-room' ack for THIS
  // socket connection. False the instant the socket drops, and while a
  // reconnect is in flight. Sends made while this is false are queued
  // instead of firing straight at a socket that the server will reject
  // with "Not connected to a room" — which is how images used to
  // silently vanish after a brief network blip mid-upload.
  const isReadyRef = useRef(false);
  const pendingSendsRef = useRef([]);

  // Bumped every time the socket disconnects. A join-room acknowledgment
  // only gets to flip isReadyRef back to true if the epoch it was sent
  // under still matches the current one — otherwise it's a stale ack from
  // an earlier connection attempt that has since disconnected again, and
  // applying it would falsely mark us "ready" on a socket the server
  // never actually joined to a room. On a flaky connection you can get:
  // connect -> join-room sent (A) -> disconnect -> reconnect -> join-room
  // sent (B, succeeds) -> A's stale callback finally arrives and
  // unconditionally sets isReadyRef = true, even though the live socket
  // was never told about the room by attempt A. That's what produced
  // "Not connected to a room" errors on a poor connection: the client
  // believed it was ready, the server disagreed. This epoch check closes
  // that race by discarding any ack that isn't for the most recent attempt.
  const connectionEpochRef = useRef(0);

  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Shown when a text message fails to send OR gets stuck waiting for the
  // socket to become ready again — previously these failures were only
  // console.error'd, so a message could vanish from the chat with zero
  // visible feedback to the person who sent it.
  const [sendError, setSendError] = useState('');

  // Typing indicator: who (other than me) is currently typing.
  const [typingUser, setTypingUser] = useState(null);
  const isTypingRef = useRef(false);
  const typingStopTimerRef = useRef(null);

  // "Hide track song" — lets either side collapse the Now Playing bar to
  // reclaim vertical space for the chat itself, without losing the player.
  // IMPORTANT: this must only hide the player visually. MusicPlayer stays
  // mounted at all times (see render below) — toggling this used to
  // conditionally render <MusicPlayer />, which unmounted the underlying
  // <audio> element and killed playback for whoever hid it, on both the
  // host and friend side.
  const [showNowPlaying, setShowNowPlaying] = useState(true);

  // Music: Sanu picks a track via search, we broadcast it over the socket,
  // and `room.music` (synced from the server's 'music-update' event) is the
  // single shared source of truth for "what's currently playing" — that's
  // what lets the friend's read-only "Now Playing" bar reflect Sanu's pick.
  // `showMusicSearch` is purely local UI state controlling whether Sanu sees
  // the search box or the compact now-playing summary.
  const [showMusicSearch, setShowMusicSearch] = useState(true);

  const socket = getSocket();
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [room?.messages, typingUser]);

  // Locks the page itself from scrolling/panning while the chat is open —
  // see the `.chat-room-active` rule in index.css for why this has to be a
  // real CSS lock on <html>/<body> and not just something handled inside
  // this component's own div. Scoped to this component's lifetime only:
  // added on mount, removed on unmount, so Landing/Goodbye/JoinRoom (which
  // rely on normal page scrolling) are unaffected.
  useEffect(() => {
    document.documentElement.classList.add('chat-room-active');
    document.body.classList.add('chat-room-active');
    return () => {
      document.documentElement.classList.remove('chat-room-active');
      document.body.classList.remove('chat-room-active');
    };
  }, []);

  // --- Keyboard-safe viewport handling --------------------------------
  // This container is sized from `var(--app-height)` (see the style prop
  // below and index.css), a CSS custom property that useKeyboardOpen.js
  // keeps glued to `visualViewport.height` in px, continuously, for the
  // full duration of every keyboard open/close animation — not just
  // `100dvh` on its own. Relying on `100dvh` plus `<meta viewport
  // ... interactive-widget=resizes-content>` (see index.html) alone
  // looked sufficient on paper — the spec says the layout viewport itself
  // shrinks with the keyboard, so `100dvh` should track it every frame
  // with no JS involved — but real devices don't reliably honor that:
  // older Chrome/WebView builds and in-app browsers silently ignore the
  // meta tag and fall back to leaving the layout viewport (and therefore
  // `100dvh`) at its pre-keyboard size. When that happens the flex column
  // is sized to a box taller than what's actually visible, so its last
  // child (the composer) lands wherever normal flow puts it inside that
  // oversized box instead of pinned to the bottom of the real, keyboard-
  // shrunk viewport — which is exactly the floating composer with dead
  // gaps above and below it that testing turned up. Driving the height
  // from `visualViewport` directly sidesteps whether `dvh`/resize-content
  // is supported at all; `100dvh` is kept only as the first-paint
  // fallback before the hook's effect runs once.
  //
  // The one real failure mode a JS-computed height has to guard against
  // is settling on a stale mid-animation reading and freezing there —
  // the hook's rAF loop (started on every resize/scroll/focus change,
  // not just once) is what prevents that: it keeps re-reading for the
  // full length of the animation instead of sampling it once.
  //
  // Separately, the browser auto-scrolling the *document* to keep the
  // focused input in view — which would fight this JS-resized container —
  // is handled by the `.chat-room-active` lock in index.css (`position:
  // fixed; overflow: hidden` on html/body): with the document itself
  // unable to scroll, there's nothing for that auto-scroll behavior to
  // move.
  const keyboardOpen = useKeyboardOpen();

  // Keep the latest message pinned above the composer whenever the
  // keyboard opens/closes (dvh handles the resize itself; this just
  // keeps the scroll position sensible across that resize).
  useEffect(() => {
    scrollToBottom();
  }, [keyboardOpen]);

  // Every send ultimately goes through here instead of calling socket.emit
  // directly. This is what lets us self-heal from the one failure mode the
  // connection-epoch guard (see connectionEpochRef above) can't catch:
  // isReadyRef can be legitimately true — a valid, current join-room ack
  // really did come back — and the send can *still* come back with "Not
  // connected to a room" if the server-side socket lost its room between
  // that ack and this send (e.g. the backend process itself restarted, or
  // any other server-side state loss we can't see from the client). Rather
  // than just show the person an error with no recovery, we treat that one
  // specific error as "our ready-state is stale": drop back to not-ready,
  // put the message back in the queue, and immediately try to rejoin so it
  // gets flushed automatically. `alreadyRetried` caps this at one retry per
  // message so a room that's genuinely gone fails with a real error instead
  // of looping forever.
  const emitSend = (payload, callback, alreadyRetried = false) => {
    socket.emit('send-message', payload, (response) => {
      if (response?.error === 'Not connected to a room' && !alreadyRetried) {
        isReadyRef.current = false;
        pendingSendsRef.current.push({ payload, callback, retried: true });
        handleReconnect();
        return;
      }
      callback?.(response);
    });
  };

  // Flush anything queued while the socket wasn't ready. Called right after
  // any successful (re)join.
  const flushPendingSends = () => {
    const queued = pendingSendsRef.current;
    pendingSendsRef.current = [];
    queued.forEach(({ payload, callback, retried }) => emitSend(payload, callback, retried));
  };

  // Every text message / image / video goes through here instead of calling
  // socket.emit directly, so a message made mid-reconnect is queued and
  // flushed rather than lost.
  //
  // Previously a queued message could sit in pendingSendsRef forever with
  // no feedback if flushPendingSends() never got called again (e.g. the
  // UI still reports "connected" but isReadyRef silently desynced from
  // reality). Now, anything still sitting in the queue after
  // SEND_QUEUE_TIMEOUT_MS surfaces an error instead of disappearing.
  const sendWhenReady = (payload, callback) => {
    if (isReadyRef.current) {
      emitSend(payload, callback);
    } else {
      const entry = { payload, callback };
      pendingSendsRef.current.push(entry);
      setTimeout(() => {
        const idx = pendingSendsRef.current.indexOf(entry);
        if (idx !== -1) {
          // Still stuck waiting — pull it out of the queue and tell the
          // caller instead of leaving it to flush silently whenever (or
          // never).
          pendingSendsRef.current.splice(idx, 1);
          callback?.({ error: 'Still trying to reconnect — message was not sent. Please try again.' });
        }
      }, SEND_QUEUE_TIMEOUT_MS);
    }
  };

  useEffect(() => {
    if (!code) return navigate('/');

    const checkRoom = async () => {
      try {
        // adminFetch already awaits response.json() internally and throws
        // (with the server's error message) on a non-OK response — it
        // returns the parsed data directly, not a Response object. Calling
        // .json()/.ok on its return value here was the bug: it threw
        // "res.json is not a function" on every load, which this catch
        // block silently turned into a misleading "Failed to connect to
        // server" for every room, healthy or not.
        const data = await adminFetch(`/rooms/${code}`);

        setRoomInfo(data);

        const credentialsStr = sessionStorage.getItem(`room_${code}`);
        if (credentialsStr) {
          const credentials = JSON.parse(credentialsStr);
          connectToRoom(credentials.nickname, credentials.password);
        } else {
          setJoinStep('intro');
        }
      } catch (err) {
        setError(err.message || 'Failed to connect to server');
        setJoinStep('error');
      }
    };

    checkRoom();

    return () => {
      socket.off('receive-message');
      socket.off('chat-history-cleared');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('online-count');
      socket.off('music-update');
      socket.off('user-disconnected');
      socket.off('user-reconnected');
      socket.off('user-kicked');
      socket.off('kicked');
      socket.off('room-closed');
      socket.off('user-typing');
      socket.off('user-stopped-typing');
      socket.off('join-approved');
      socket.off('join-denied');
      socket.off('join-request');
      socket.off('join-request-cancelled');
      hasJoinedRef.current = false;
      isReadyRef.current = false;
      pendingSendsRef.current = [];
      socket.disconnect();
    };
  }, [code, navigate, socket]);

  const handleDrop = () => {
    isReadyRef.current = false;
    // A new connection attempt is about to start (or the socket is just
    // sitting disconnected) — any join-room ack still in flight from the
    // attempt that just dropped is now stale and must not be trusted.
    connectionEpochRef.current += 1;
    if (hasJoinedRef.current) setConnectionStatus('reconnecting');
  };

  const handleReconnect = () => {
    if (!hasJoinedRef.current) return;
    const credentialsStr = sessionStorage.getItem(`room_${code}`);
    if (!credentialsStr) return;
    const { nickname, password } = JSON.parse(credentialsStr);
    const clientId = getOrCreateClientId(code);
    const epochAtSend = connectionEpochRef.current;
    socket.emit('join-room', { roomCode: code, nickname, password, clientId }, (response) => {
      if (!response) return;

      // A newer disconnect happened since this request went out — this ack
      // is stale (it belongs to a connection attempt that has since been
      // superseded). Discard it entirely rather than let it override
      // whatever the current, more recent connection attempt decided —
      // this is what used to cause "Not connected to a room" on flaky
      // connections.
      if (epochAtSend !== connectionEpochRef.current) return;

      if (response.error) {
        // The room may genuinely be gone (e.g. it was closed while we were
        // offline) — surface that clearly instead of leaving the UI stuck
        // on "Reconnecting...".
        sessionStorage.removeItem(`room_${code}`);
        setError(response.error);
        setJoinStep('error');
        return;
      }

      if (response.pending) {
        // The grace window lapsed before we made it back, so Sanu has to
        // re-approve us — don't crash trying to read response.room.
        isReadyRef.current = false;
        setJoinStep('pending');
        return;
      }

      setRoom(response.room);
      setOnlineCount(response.room.members.length);
      setConnectionStatus('connected');
      isReadyRef.current = true;
      flushPendingSends();
    });
  };

  useEffect(() => {
    socket.on('connect', handleReconnect);
    socket.on('disconnect', handleDrop);
    return () => {
      socket.off('connect', handleReconnect);
      socket.off('disconnect', handleDrop);
    };
  }, [socket, code]);

  const connectToRoom = (nickname, password) => {
    setIsJoining(true);
    socket.connect();
    const clientId = getOrCreateClientId(code);
    const epochAtSend = connectionEpochRef.current;
    socket.emit('join-room', { roomCode: code, nickname, password, clientId }, (response) => {
      setIsJoining(false);
      // Same stale-ack guard as handleReconnect — the socket may have
      // dropped and reconnected again before this particular ack arrived.
      if (epochAtSend !== connectionEpochRef.current) return;
      if (response.error) {
        setError(response.error);
        setJoinStep('error');
        // Don't let a stale/invalid/kicked session keep retrying silently
        // on the next visit — clear it so they get a clean join form or
        // the "this room has ended" screen instead of a login loop.
        sessionStorage.removeItem(`room_${code}`);
      } else if (response.pending) {
        // Not admitted yet — Sanu needs to approve this join first.
        setJoinStep('pending');
      } else {
        setRoom(response.room);
        setOnlineCount(response.room.members.length);
        setIsHost(response.isHost);
        isHostRef.current = response.isHost;
        setJoinStep('joined');
        setConnectionStatus('connected');
        hasJoinedRef.current = true;
        isReadyRef.current = true;
        flushPendingSends();
      }
    });

    // 🔧 FIXED: Sanu approved the pending request — finish joining exactly like a
    // normal successful join-room ack would have. This only ever fires
    // once, for the specific socket Sanu approved, so there's no
    // stale-ack path here the way there is for join-room's own callback.
    // The backend now properly initializes currentRoom/currentUser on the
    // requester's socket, so this flows seamlessly into the chat.
    socket.on('join-approved', (response) => {
      sessionStorage.setItem(`room_${code}`, JSON.stringify({ nickname, password }));
      setRoom(response.room);
      setOnlineCount(response.room.members.length);
      setIsHost(response.isHost);
      isHostRef.current = response.isHost;
      setJoinStep('joined');
      setConnectionStatus('connected');
      hasJoinedRef.current = true;
      isReadyRef.current = true;
      flushPendingSends();
    });

    // Sanu denied it (or the room filled up while waiting).
    socket.on('join-denied', ({ reason }) => {
      sessionStorage.removeItem(`room_${code}`);
      setError(reason || 'Sanu declined your request to join.');
      setJoinStep('error');
    });

    // Host-side: someone is waiting to be let in.
    socket.on('join-request', ({ requestId, nickname: reqNickname }) => {
      setJoinRequests((prev) => (
        prev.some((r) => r.requestId === requestId) ? prev : [...prev, { requestId, nickname: reqNickname }]
      ));
    });

    // Host-side: they left before Sanu answered — drop them from the queue.
    socket.on('join-request-cancelled', ({ requestId }) => {
      setJoinRequests((prev) => prev.filter((r) => r.requestId !== requestId));
    });

    socket.on('receive-message', (message) => {
      setRoom((prev) => prev ? { ...prev, messages: [...prev.messages, message] } : prev);
    });

    // Sanu cleared the chat — wipe messages for everyone in the room, and
    // drop any in-progress reply quote since its target is now gone.
    socket.on('chat-history-cleared', () => {
      setRoom((prev) => prev ? { ...prev, messages: [] } : prev);
      setReplyingTo(null);
    });

    socket.on('user-joined', (user) => {
      // Defensive de-dupe: if a duplicate 'user-joined' ever arrives for
      // someone already in the list (e.g. an old event delivered late),
      // replace rather than append.
      setRoom((prev) => prev ? { ...prev, members: mergeMember(prev.members, user) } : prev);
    });

    socket.on('user-left', (userId) => {
      setRoom((prev) => prev ? { ...prev, members: prev.members.filter(m => m.id !== userId) } : prev);
      setPeerStatus(null);
    });

    // THE FIX: previously this only set the peerStatus banner text — the
    // Members sidebar list itself was never touched, so it kept showing
    // whoever disconnected as a normal, fully-online member (bright pink
    // dot, no indication anything changed) for the ENTIRE 60-second
    // reconnect grace window, even though `online-count` had already
    // dropped. That's exactly the mismatch in the screenshot: "1 online"
    // while the sidebar still listed both people with no visual
    // difference. Now we also mark that member `connected: false` in
    // local state immediately, so the sidebar shows a grey dot + "left"
    // right away instead of lying for up to a minute.
    socket.on('user-disconnected', (info) => {
      setPeerStatus(info);
      setRoom((prev) => prev
        ? { ...prev, members: prev.members.map((m) => (m.id === info.userId ? { ...m, connected: false } : m)) }
        : prev);
    });

    // The reconnecting person comes back with a NEW socket id. Previously
    // this only cleared the "reconnecting..." banner and left their old
    // row (old id) sitting in the member list, so a reconnect could show
    // up as two entries for the same person. Now we replace the stale row
    // — the fresh `user` object has no `connected: false` flag, so the
    // sidebar dot goes back to pink automatically.
    socket.on('user-reconnected', (user) => {
      setPeerStatus(null);
      setRoom((prev) => prev ? { ...prev, members: mergeMember(prev.members, user) } : prev);
    });

    // Someone else got kicked — drop them from the member list for
    // everyone still in the room, Sanu included.
    socket.on('user-kicked', ({ userId }) => {
      setRoom((prev) => prev ? { ...prev, members: prev.members.filter(m => m.id !== userId) } : prev);
      setPeerStatus(null);
    });

    // This client got kicked by Sanu. Distinct from 'room-closed' — the
    // room keeps running for everyone else, only this person is removed,
    // and it can never happen to Sanu (the backend only lets an admin kick
    // someone else).
        socket.on('kicked', () => {
      // Removed friends see the same Goodbye screen as a normal room
      // close — no interim ad screen on this transition, and no way to
      // walk back in on the old link/nickname (the server blocks that
      // via kickedNicknames).
      sessionStorage.removeItem(`room_${code}`);
      navigate('/goodbye', { state: { reason: 'You were removed from this room' } });
    });

    socket.on('online-count', (count) => {
      setOnlineCount(count);
    });

    socket.on('music-update', (musicState) => {
      setRoom((prev) => prev ? { ...prev, music: musicState } : prev);
    });

    socket.on('user-typing', ({ nickname }) => {
      setTypingUser(nickname);
    });

    socket.on('user-stopped-typing', () => {
      setTypingUser(null);
    });

    socket.on('room-closed', (payload) => {
      sessionStorage.removeItem(`room_${code}`);
      if (isHostRef.current) {
        // Sanu ending the room goes back to the Admin Panel, not the
        // public homepage — the friend-facing goodbye/ad screen is for
        // friends only.
        setJoinStep('host-goodbye');
        setTimeout(() => navigate('/admin'), 2000);
      } else {
        const endedBy = payload?.endedBy;
        const reason = endedBy === 'admin'
          ? 'This room was closed by an admin'
          : 'Sanu has ended the chat';
        navigate('/goodbye', { state: { reason, showAd: true } });
      }
    });
  };

  const handleJoinSubmit = (e) => {
    e.preventDefault();
    if (!joinNickname.trim()) return;
    sessionStorage.setItem(`room_${code}`, JSON.stringify({ nickname: joinNickname, password: joinPassword }));
    connectToRoom(joinNickname, joinPassword);
  };

  const stopTyping = () => {
    if (isTypingRef.current) {
      isTypingRef.current = false;
      socket.emit('typing-stop');
    }
    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
    }
  };

  const handleInputChange = (e) => {
    setInputText(e.target.value);

    if (e.target.value.trim()) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        socket.emit('typing-start');
      }
      if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = setTimeout(stopTyping, TYPING_STOP_DELAY_MS);
    } else {
      stopTyping();
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const text = inputText;
    const activeReply = replyingTo;
    setInputText('');
    setReplyingTo(null);
    setSendError('');
    stopTyping();
    // Only send as { text, replyTo } when actually replying — plain
    // string payloads still work exactly as before for a normal message,
    // so this doesn't change behavior for the common case.
    const payload = activeReply ? { text, replyTo: activeReply.id } : text;
    sendWhenReady(payload, (response) => {
      if (response && response.error) {
        console.error(response.error);
        setSendError(response.error);
        setInputText(text);
        if (activeReply) setReplyingTo(activeReply);
      }
    });
  };

  const handleReplyTo = (msg) => {
    setReplyingTo({
      id: msg.id,
      nickname: msg.userId === socket.id ? 'You' : msg.nickname,
      text: msg.type === 'text' ? msg.text : `[${msg.type}]`,
      type: msg.type
    });
  };

  const handleClearHistory = () => {
    setClearingHistory(true);
    socket.emit('admin-clear-history', null, (response) => {
      setClearingHistory(false);
      if (response?.error) {
        setError(response.error);
      }
    });
  };

  // Friends see a short ad before the file picker opens; Sanu (host) and
  // anyone browsing as admin skip straight to the picker — this gate is a
  // revenue placement, not a real restriction, so it shouldn't exist for
  // either of them. `imageAdCountdown` disables the Continue button for a
  // few seconds so the ad actually gets seen instead of being instantly
  // dismissed.
  const [showImageAdGate, setShowImageAdGate] = useState(false);
  const [imageAdCountdown, setImageAdCountdown] = useState(10);

  useEffect(() => {
    if (!showImageAdGate || imageAdCountdown <= 0) return undefined;
    const timer = setTimeout(() => setImageAdCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [showImageAdGate, imageAdCountdown]);

  const handleImageClick = () => {
    // isAdmin starts as `undefined` while the admin-session check is still
    // in flight (see AdminContext). Treating "not yet true" as "show the
    // ad gate" meant Sanu could see this popup for real photos sent while
    // the admin check was still loading — checking `isAdmin !== false`
    // instead means we only show the gate once non-admin status is
    // actually confirmed, matching how the ad components themselves treat
    // undefined (see useIsAdmin's doc comment).
    if (isHost || isAdmin !== false) {
      fileInputRef.current?.click();
      return;
    }
    setImageAdCountdown(5);
    setShowImageAdGate(true);
  };

  const handleImageAdContinue = () => {
    setShowImageAdGate(false);
    fileInputRef.current?.click();
  };

  // Images and videos both go through the same flow now: upload the file
  // over HTTP, then send the resulting URL as a normal chat message. The
  // HTTP upload itself doesn't depend on the socket, but the follow-up
  // 'send-message' does — sendWhenReady() queues it if the socket dropped
  // mid-upload instead of losing the photo once it's already on the server.
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so picking the same file again still fires onChange
    if (!file) return;

    setUploadError('');

    const isVideo = file.type.startsWith('video/');
    const maxBytes = isVideo ? 60 * 1024 * 1024 : 15 * 1024 * 1024;
    if (file.size > maxBytes) {
      setUploadError(isVideo ? 'Video must be smaller than 60MB' : 'Image must be smaller than 15MB');
      return;
    }

    setIsUploading(true);
    try {
      const { url, type } = await uploadMedia(file);
      sendWhenReady({ mediaUrl: url, mediaType: type }, (response) => {
        if (response && response.error) setUploadError(response.error);
      });
    } catch (err) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/room/${code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleEndConversation = () => {
    socket.emit('end-room', null, (response) => {
      if (response?.error) {
        setError(response.error);
        return;
      }
      sessionStorage.removeItem(`room_${code}`);
      setJoinStep('host-goodbye');
      setTimeout(() => navigate('/admin'), 2000);
    });
  };

  const handleLeave = () => {
    // Wait for the server to actually confirm the leave before tearing
    // down the socket. Firing 'leave-room' and calling socket.disconnect()
    // on the very next line (the old code) is a race: Socket.IO doesn't
    // guarantee that emit's packet reaches the server before disconnect()
    // closes the transport, especially on a slow mobile connection. If
    // disconnect() won that race, the server never saw an explicit leave
    // at all — just a bare drop — and fell back to the 60s reconnect-grace
    // window instead of removing this person immediately, which is exactly
    // the "I left but I still show as here" bug. The 1.5s timeout is just
    // a safety net so a dead/slow connection can't leave the Leave button
    // stuck — it still navigates away either way, just possibly without
    // the clean server-side removal in that edge case.
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      socket.disconnect();
      sessionStorage.removeItem(`room_${code}`);
      // Friend chose to leave on their own — same Goodbye screen as any
      // other end of the session, not a bare drop to the homepage.
      navigate('/goodbye', { state: { reason: 'You left the chat' } });
    };
    const timeout = setTimeout(finish, 1500);
    socket.emit('leave-room', null, () => {
      clearTimeout(timeout);
      finish();
    });
  };

  // Sanu-only: remove a friend from the room. They're disconnected and
  // barred from rejoining via the same link; everyone else is unaffected.
  const handleKick = (member) => {
    if (!isHost || member.id === socket.id) return;
    if (!window.confirm(`Remove ${member.nickname} from this room?`)) return;
    socket.emit('admin-kick-user', { userId: member.id }, (response) => {
      if (response?.error) setError(response.error);
    });
  };

  // Sanu-only: let someone in (or turn them away) from the join queue.
  const handleRespondJoin = (requestId, approve) => {
    setJoinRequests((prev) => prev.filter((r) => r.requestId !== requestId));
    socket.emit('respond-join-request', { requestId, approve });
  };

  // Sanu-only: pick a track. Broadcast it so the friend's read-only
  // "Now Playing" bar updates too — `room.music` (set from the
  // 'music-update' socket event) is the shared source of truth, so we
  // don't need to keep a separate local "selected track" state here.
  const handleSelectTrack = (track) => {
    socket.emit('set-music', track);
    setShowMusicSearch(false);
    setShowNowPlaying(true);
  };

  // Sanu-only playback controls — broadcast so the friend's player mirrors
  // it (see MusicPlayer's sync logic).
  const handleMusicPlay = (position) => socket.emit('music-play', { position });
  const handleMusicPause = (position) => socket.emit('music-pause', { position });
  const handleMusicSeek = (position) => socket.emit('music-seek', { position });

  if (joinStep === 'host-goodbye') {
    return (
      <div className="min-h-screen bg-[#0D0D0F] flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[#151518] p-10 rounded-[2rem] shadow-2xl max-w-md w-full text-center border border-white/5 backdrop-blur-xl flex flex-col items-center"
        >
          <div className="text-[#f472b6] mb-6"><Heart size={48} className="fill-[#f472b6]" /></div>
          <h2 className="text-2xl font-serif text-white mb-4 tracking-wide">
            Room Closed
          </h2>
          <p className="text-zinc-400 mb-8 font-light">
            Taking you back to your Admin Panel...
          </p>
          <div className="flex gap-2">
            <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity }} className="w-2 h-2 rounded-full bg-[#ff8bb3]" />
            <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity, delay: 0.2 }} className="w-2 h-2 rounded-full bg-[#ff8bb3]" />
            <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity, delay: 0.4 }} className="w-2 h-2 rounded-full bg-[#ff8bb3]" />
          </div>
          <p className="text-zinc-600 mt-6 text-xs tracking-widest uppercase">Redirecting...</p>
        </motion.div>
      </div>
    );
  }

  if (joinStep === 'checking') {
    return (
      <div className="min-h-screen bg-[#0D0D0F] flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-serif text-white tracking-wide mb-6">SANU WORLD</h1>
        <p className="text-zinc-500 font-sans tracking-widest text-sm uppercase mb-4">Loading room...</p>
        <div className="flex gap-2">
          <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity }} className="w-2 h-2 rounded-full bg-[#ff8bb3]" />
          <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity, delay: 0.2 }} className="w-2 h-2 rounded-full bg-[#ff8bb3]" />
          <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity, delay: 0.4 }} className="w-2 h-2 rounded-full bg-[#ff8bb3]" />
        </div>
      </div>
    );
  }

  if (joinStep === 'error') {
    const isStaleLink = error === 'Room not found' || error === 'You have been removed from this room';
    const isJoinDenied = error === 'Sanu declined your request to join.';
    return (
      <div className="min-h-screen bg-[#0D0D0F] flex flex-col items-center justify-center p-4">
        <div className="bg-[#151518] p-10 rounded-[2rem] shadow-2xl max-w-md w-full text-center border border-white/5 backdrop-blur-xl">
          <div className="text-red-400 mb-6 flex justify-center"><X size={48} /></div>
          <h2 className="text-2xl font-serif text-white mb-2 tracking-wide">
            {isStaleLink ? 'This room has ended' : isJoinDenied ? 'Not this time' : 'Oops!'}
          </h2>
          <p className="text-zinc-400 mb-8 font-light">
            {isStaleLink ? 'This link is no longer active.' : error}
          </p>
          <button
            onClick={() => navigate('/')}
            className="bg-white hover:bg-zinc-200 text-zinc-950 font-medium py-3 px-8 rounded-full transition-colors shadow-lg"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (joinStep === 'intro' && roomInfo) {
    return (
      <div className="min-h-screen bg-[#0D0D0F] flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg h-[400px] bg-[#ff8bb3]/5 blur-[150px] rounded-full pointer-events-none" />
        <div className="w-full max-w-md relative z-10 flex flex-col gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#151518] p-8 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/5 backdrop-blur-xl text-center"
          >
            <h3 className="font-serif text-xl tracking-wide text-white opacity-60 mb-6 flex items-center justify-center gap-2">
              <Heart size={16} className="text-[#f472b6] fill-[#f472b6]" /> SANU WORLD
            </h3>
            <h2 className="text-3xl font-serif text-white mb-2">
              {roomInfo.name}
            </h2>

            <div className="flex justify-center items-center gap-2 text-green-400 font-medium text-sm mb-8">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span>Sanu is online</span>
            </div>

            {error && (
              <div className="bg-red-500/10 text-red-400 p-4 rounded-xl text-sm mb-8 border border-red-500/20 text-center">
                {error}
              </div>
            )}

            <form onSubmit={handleJoinSubmit} className="space-y-6 text-left">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Your Name</label>
                <input
                  type="text"
                  required
                  value={joinNickname}
                  onChange={(e) => setJoinNickname(e.target.value)}
                  placeholder="e.g. Rahul"
                  className="w-full px-5 py-4 bg-[#0D0D0F] border border-zinc-800 rounded-2xl focus:outline-none focus:border-[#ff8bb3] text-white placeholder-zinc-600 transition-all text-center text-lg"
                  maxLength={20}
                />
              </div>

              {roomInfo?.requiresPassword && (
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Password</label>
                  <input
                    type="password"
                    required
                    value={joinPassword}
                    onChange={(e) => setJoinPassword(e.target.value)}
                    placeholder="Room password"
                    className="w-full px-5 py-4 bg-[#0D0D0F] border border-zinc-800 rounded-2xl focus:outline-none focus:border-[#ff8bb3] text-white placeholder-zinc-600 transition-all text-center text-lg"
                  />
                </div>
              )}

              <motion.button
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isJoining || !joinNickname.trim()}
                className="w-full bg-white text-zinc-950 hover:bg-zinc-200 disabled:opacity-50 font-bold py-4 px-4 rounded-full transition-all tracking-wider text-sm shadow-[0_5px_15px_rgba(255,255,255,0.1)] flex items-center justify-center gap-2"
              >
                {isJoining ? 'Joining...' : 'Join Sanu \u2192'}
              </motion.button>
            </form>

            {isAdmin === false && (
              <div className="mt-6 space-y-3">
                <TopAd />
                <BottomAd />
              </div>
            )}
          </motion.div>
        </div>
      </div>
    );
  }

  if (joinStep === 'pending') {
    return (
      <div className="min-h-screen bg-[#0D0D0F] flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg h-[400px] bg-[#ff8bb3]/5 blur-[150px] rounded-full pointer-events-none" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#151518] p-10 rounded-[2rem] shadow-2xl max-w-md w-full text-center border border-white/5 backdrop-blur-xl relative z-10 flex flex-col items-center"
        >
          <div className="text-[#f472b6] mb-6"><Heart size={48} className="fill-[#f472b6]" /></div>
          <h2 className="text-2xl font-serif text-white mb-3 tracking-wide">
            Waiting for Sanu
          </h2>
          <p className="text-zinc-400 mb-8 font-light">
            You've asked to join. Sanu needs to let you in — this page will update automatically the moment they respond.
          </p>
          <div className="flex gap-2">
            <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity }} className="w-2 h-2 rounded-full bg-[#ff8bb3]" />
            <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity, delay: 0.2 }} className="w-2 h-2 rounded-full bg-[#ff8bb3]" />
            <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity, delay: 0.4 }} className="w-2 h-2 rounded-full bg-[#ff8bb3]" />
          </div>
        </motion.div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div
      className="bg-zinc-950 flex flex-col overflow-hidden text-zinc-100"
      style={{ height: 'var(--app-height, 100dvh)' }}
    >
      {/* Header */}
      <header className="bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-800 px-5 py-4 flex flex-col gap-3 shrink-0 z-10 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 -ml-2 rounded-lg hover:bg-zinc-800 text-zinc-400 md:hidden transition-colors"
            >
              <Menu size={24} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white leading-tight tracking-wide flex items-center gap-2">
                {room.name}
                {isHost && (
                  <span className="flex items-center gap-1 text-[10px] font-bold tracking-widest uppercase bg-gradient-to-r from-pink-500/20 to-fuchsia-500/20 text-pink-300 border border-pink-500/30 px-2 py-0.5 rounded-full">
                    <Crown size={11} className="fill-pink-300" /> Sanu · Admin
                  </span>
                )}
              </h1>
              <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1">
                {connectionStatus === 'reconnecting' ? (
                  <span className="flex items-center gap-1.5 font-medium text-yellow-400">
                    <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></div>
                    Reconnecting...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 font-medium text-pink-400">
                    <div className="w-2 h-2 rounded-full bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.6)]"></div>
                    {onlineCount} online
                  </span>
                )}
                <span className="text-zinc-600">•</span>
                <span className="font-mono bg-zinc-800 px-2 py-0.5 rounded-md text-zinc-300 font-bold tracking-widest">{room.code}</span>
                {peerStatus && (
                  <>
                    <span className="text-zinc-600">•</span>
                    <span className="flex items-center gap-1.5 font-medium text-yellow-400">
                      <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></div>
                      {peerStatus.nickname} reconnecting...
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isHost && (
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white rounded-xl text-sm font-semibold transition-colors border border-zinc-700"
                title="Share Room Link"
              >
                {copied ? <CheckCircle2 size={16} className="text-pink-400" /> : <Share2 size={16} />}
                <span className="hidden sm:inline">{copied ? 'Copied!' : 'Share'}</span>
              </button>
            )}
            {isHost && (
              <button
                onClick={() => {
                  if (window.confirm('Clear all chat history for everyone in this room? This cannot be undone.')) {
                    handleClearHistory();
                  }
                }}
                disabled={clearingHistory}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white rounded-xl text-sm font-semibold transition-colors border border-zinc-700 disabled:opacity-50"
                title="Clear Chat History"
              >
                {clearingHistory ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                <span className="hidden sm:inline">Clear History</span>
              </button>
            )}
            {isHost ? (
              <button
                onClick={() => {
                  if (window.confirm('End the conversation for both of you?')) {
                    handleEndConversation();
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl text-sm font-semibold transition-colors border border-red-500/20"
                title="End Conversation"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">End Conversation</span>
              </button>
            ) : (
              <button
                onClick={handleLeave}
                className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                title="Leave Room"
              >
                <LogOut size={20} />
              </button>
            )}
          </div>
        </div>

        {isHost ? (
          <div className="w-full flex flex-col gap-2 pt-1">
            {showMusicSearch ? (
              <div className="flex flex-col gap-2">
                {room?.music?.streamUrl && (
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs text-zinc-500">Choose a song</span>
                    <button
                      type="button"
                      onClick={() => setShowMusicSearch(false)}
                      className="text-zinc-500 hover:text-zinc-300 transition-colors"
                      title="Cancel"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
                <MusicSearch
                  isHost={isHost}
                  onSelectTrack={handleSelectTrack}
                />
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-zinc-950/60 backdrop-blur-md rounded-xl p-2 border border-zinc-700/50 w-full shadow-inner">
                <div className="w-8 h-8 rounded-full bg-pink-500/20 text-pink-400 flex items-center justify-center shrink-0">
                  <Music size={16} />
                </div>
                <span className="text-xs font-medium text-zinc-300 truncate flex-1">
                  {room?.music?.streamUrl ? `${room.music.title} — ${room.music.artist}` : 'No song selected'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowMusicSearch(true)}
                  className="text-xs font-bold text-pink-400 hover:text-pink-300 px-3 py-1 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 transition-colors shrink-0"
                >
                  {room?.music?.streamUrl ? 'Change Song' : 'Search Music'}
                </button>
                {room?.music?.streamUrl && (
                  <button
                    type="button"
                    onClick={() => setShowNowPlaying((v) => !v)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-zinc-400 hover:text-zinc-200 transition-colors shrink-0 px-2 py-1 rounded-lg hover:bg-zinc-800"
                    title={showNowPlaying ? 'Hide player' : 'Show player'}
                  >
                    {showNowPlaying ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    <span className="hidden sm:inline">{showNowPlaying ? 'Hide Player' : 'Show Player'}</span>
                  </button>
                )}
              </div>
            )}
            {room?.music?.streamUrl && (
              <div className={showNowPlaying ? '' : 'hidden'}>
                <MusicPlayer
                  track={room.music}
                  isHost
                  onPlay={handleMusicPlay}
                  onPause={handleMusicPause}
                  onSeek={handleMusicSeek}
                />
              </div>
            )}
          </div>
        ) : room?.music?.streamUrl && (
          <div className="w-full flex flex-col gap-2 pt-1">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Music size={12} className="text-pink-400" />
                <span>Now Playing · Sanu's pick</span>
              </div>
              <button
                type="button"
                onClick={() => setShowNowPlaying((v) => !v)}
                className="flex items-center gap-1 text-[11px] font-semibold text-zinc-400 hover:text-zinc-200 transition-colors px-2 py-1 rounded-lg hover:bg-zinc-800"
                title={showNowPlaying ? 'Hide player' : 'Show player'}
              >
                {showNowPlaying ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                <span>{showNowPlaying ? 'Hide Player' : 'Show Player'}</span>
              </button>
            </div>
            <div className={showNowPlaying ? '' : 'hidden'}>
              <MusicPlayer track={room.music} isHost={false} />
            </div>
          </div>
        )}
      </header>

      {isHost && joinRequests.length > 0 && (
        <div className="shrink-0 z-20 bg-zinc-900 border-b border-pink-500/30 px-4 py-3 space-y-2">
          <AnimatePresence>
            {joinRequests.map((req) => (
              <motion.div
                key={req.requestId}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center justify-between gap-3 bg-pink-500/10 border border-pink-500/30 rounded-xl px-4 py-2.5"
              >
                <span className="text-sm text-zinc-100">
                  <span className="font-bold text-pink-300">{req.nickname}</span> wants to join
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleRespondJoin(req.requestId, true)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-pink-500 hover:bg-pink-400 text-white transition-colors"
                  >
                    Let them in
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRespondJoin(req.requestId, false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                  >
                    Decline
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-zinc-950 relative overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-pink-600/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-fuchsia-600/10 rounded-full blur-[100px] pointer-events-none" />

          {/* Gated behind !keyboardOpen for the same reason BottomAd/
              ChatBottomAd already are (see the note lower down): this ad
              sits in normal document flow, so if it stays mounted while
              the keyboard is open, its refreshSeconds timer keeps firing
              every 60s and remounting a fresh ad iframe mid-typing. That
              iframe reload runs the ad network's script again, which can
              nudge scroll/viewport state and fight with our
              visualViewport-driven height tracking — reopening the exact
              keyboard gap this whole file works to prevent. Unmounting it
              while the keyboard is up removes that interference at the
              source, same as it already does for the ads below the
              composer. */}
          {!isHost && isAdmin === false && !keyboardOpen && (
            <div className="w-full bg-zinc-900/50 backdrop-blur-md border-b border-zinc-800 flex items-center justify-center shrink-0 z-10 py-2 px-4">
              <TopAd refreshSeconds={60} />
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-4 relative z-10">
            {room.messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-4">
                <Send size={48} className="opacity-20" />
                <p className="font-medium tracking-wide">No messages yet. Say hello!</p>
              </div>
            ) : (
              room.messages.map((msg, idx) => {
                const isMe = msg.userId === socket.id;
                const showHeader = idx === 0 || room.messages[idx - 1].userId !== msg.userId || (msg.timestamp - room.messages[idx - 1].timestamp > 60000);

                // Every 10 messages, drop a native ad into the feed itself —
                // this is the highest-dwell-time surface in the app, so it's
                // the one place an in-feed placement actually gets seen
                // repeatedly during a single visit instead of just once on
                // page load. Skipped for the host/admin so Sanu's own view
                // of the room stays clean, and skipped on message 0 so the
                // feed never opens on an ad before there's any real content.
                const showFeedAd = idx > 0 && idx % 10 === 9 && !isHost && isAdmin === false;

                return (
                  <React.Fragment key={msg.id}>
                  {showFeedAd && <NativeAd />}
                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group`}>
                    {showHeader && (
                      <div className={`text-xs text-zinc-500 mb-1.5 flex items-center gap-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        <span className="font-semibold text-zinc-300">{isMe ? 'You' : msg.nickname}</span>
                        {msg.isAdmin && (
                          <Crown size={11} className="text-pink-400 fill-pink-400/70" aria-label="Sanu (Admin)" />
                        )}
                        <span className="text-[10px] opacity-60">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                    <div className={`flex items-end gap-1.5 max-w-full ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div
                        className={`max-w-[85%] sm:max-w-[75%] px-5 py-3 break-words shadow-md backdrop-blur-md ${
                          isMe
                            ? 'bg-gradient-to-br from-pink-500/80 to-fuchsia-600/80 text-white rounded-2xl rounded-tr-sm font-medium border border-pink-400/30 shadow-[0_5px_15px_rgba(236,72,153,0.3)]'
                            : 'bg-zinc-800/60 text-zinc-100 rounded-2xl rounded-tl-sm border border-zinc-700/50'
                        }`}
                      >
                        {msg.replyTo && (
                          <div
                            className={`mb-2 pl-2.5 border-l-2 text-xs opacity-80 truncate max-w-[220px] ${
                              isMe ? 'border-white/50' : 'border-pink-400/60'
                            }`}
                          >
                            <div className="font-semibold">{msg.replyTo.nickname}</div>
                            <div className="truncate">{msg.replyTo.text}</div>
                          </div>
                        )}
                        {msg.type === 'image' ? (
                          <a href={msg.text} target="_blank" rel="noreferrer">
                            <img src={msg.text} alt="Shared" className="rounded-xl max-h-64 object-contain" />
                          </a>
                        ) : msg.type === 'video' ? (
                          <video
                            src={msg.text}
                            controls
                            preload="metadata"
                            className="rounded-xl max-h-64 max-w-full"
                          />
                        ) : (
                          msg.text
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleReplyTo(msg)}
                        className="p-1.5 text-zinc-500 hover:text-pink-400 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity shrink-0"
                        title="Reply"
                      >
                        <CornerUpLeft size={15} />
                      </button>
                    </div>
                  </div>
                  </React.Fragment>
                );
              })
            )}
            {typingUser && (
              <div className="flex flex-col items-start">
                <div className="text-xs text-zinc-500 mb-1.5 font-semibold">{typingUser}</div>
                <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Both ad strips below the message list are hidden while the
              on-screen keyboard is open. They sit in normal document flow
              (not position:fixed), so when the keyboard opens and shrinks
              the usable viewport, keeping them mounted eats into the
              space the message list and composer have to work with and is
              exactly what was producing the dead gap between the input
              and the keyboard. Hiding them frees that space back up and
              matches how most chat apps behave — ads step aside while
              you're actively typing, and reappear once you're done. */}
          {!isHost && isAdmin === false && !keyboardOpen && (
            <div className="w-full bg-zinc-900/50 backdrop-blur-md border-t border-zinc-800 flex items-center justify-center shrink-0 z-10 py-2 px-4">
              <BottomAd refreshSeconds={60} />
            </div>
          )}

          {!isHost && isAdmin === false && !keyboardOpen && <ChatBottomAd refreshSeconds={60} />}

          <div
            className="p-4 bg-zinc-900 border-t border-zinc-800 shrink-0"
            style={{
              // `env(safe-area-inset-bottom)` exists to clear the gesture
              // nav bar on notch-less phones. But on Android Chrome, once
              // the on-screen keyboard is up, that same env() value often
              // keeps reporting its old (non-zero) reading instead of
              // resetting to 0 — even though the keyboard now occupies
              // that space and there's no gesture bar left to clear. The
              // result: this padding silently adds a slab of dead space
              // below the input, in the same dark background color as the
              // composer itself, which is exactly the "gap" showing up in
              // testing. It's only ever needed when the keyboard is
              // closed, so we drop it entirely while typing.
              paddingBottom: keyboardOpen ? '1rem' : 'max(1rem, env(safe-area-inset-bottom))',
            }}
          >
            {uploadError && (
              <div className="mb-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {uploadError}
              </div>
            )}
            {sendError && (
              <div className="mb-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                <span>{sendError}</span>
                <button
                  type="button"
                  onClick={() => setSendError('')}
                  className="text-red-300 hover:text-red-100 shrink-0"
                  title="Dismiss"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            {replyingTo && (
              <div className="mb-2 flex items-center justify-between gap-2 bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-3 py-2">
                <div className="min-w-0 flex items-center gap-2 pl-2 border-l-2 border-pink-400/60">
                  <CornerUpLeft size={14} className="text-pink-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-zinc-300">Replying to {replyingTo.nickname}</div>
                    <div className="text-xs text-zinc-500 truncate">{replyingTo.text}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  className="p-1 text-zinc-400 hover:text-red-400 shrink-0"
                  title="Cancel reply"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            <form onSubmit={handleSendMessage} className="flex gap-3 items-end">
              <button
                type="button"
                onClick={handleImageClick}
                disabled={isUploading}
                className="p-3.5 rounded-2xl flex items-center justify-center shrink-0 transition-all bg-zinc-800 text-pink-400 hover:bg-zinc-700 disabled:opacity-50"
                title="Send Image or Video"
              >
                {isUploading ? <Loader2 size={20} className="animate-spin" /> : <ImageIcon size={20} />}
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*,video/*"
                onChange={handleImageUpload}
              />
              <input
                type="text"
                value={inputText}
                onChange={handleInputChange}
                onBlur={stopTyping}
                placeholder="Type a message..."
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="sentences"
                name="chat-message"
                data-lpignore="true"
                data-1p-ignore="true"
                className="flex-1 min-w-0 px-5 py-3.5 h-[52px] bg-zinc-950 border border-zinc-800 focus:bg-zinc-950 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 rounded-2xl transition-all outline-none text-zinc-100 placeholder-zinc-500"
                maxLength={1000}
              />
              <motion.button
                whileHover={{ scale: 1.05, rotate: 2, y: -2 }}
                whileTap={{ scale: 0.95 }}
                type="submit"
                disabled={!inputText.trim()}
                className="px-5 py-3.5 h-[52px] bg-gradient-to-r from-pink-500 to-fuchsia-500 hover:from-pink-400 hover:to-fuchsia-400 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-600 text-white rounded-2xl font-bold transition-all flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(236,72,153,0.3)] hover:shadow-[0_0_25px_rgba(236,72,153,0.5)]"
              >
                <Send size={20} className={inputText.trim() ? "translate-x-0.5" : ""} />
              </motion.button>
            </form>
          </div>
        </main>

        {/* Side rail ad — only visible on wide desktop screens (SideAd is
            "hidden xl:flex" internally) and only for real visitors, so it
            never shows up on mobile and never shows for the host/admin. */}
        {!isHost && isAdmin === false && <SideAd refreshSeconds={60} />}

        {/* Sidebar */}
        <aside
          className={`
            absolute md:static inset-y-0 right-0 w-64 bg-zinc-900 border-l border-zinc-800 shadow-2xl md:shadow-none transform transition-transform duration-300 ease-in-out z-20 flex flex-col
            ${showSidebar ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
          `}
        >
          <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900 shrink-0">
            <h3 className="font-bold text-zinc-100 flex items-center gap-2 tracking-wide">
              <Users size={18} className="text-zinc-400" />
              Members
            </h3>
            <button
              onClick={() => setShowSidebar(false)}
              className="md:hidden p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          {!isHost && isAdmin === false && <SkyscraperAd refreshSeconds={60} />}
          <div className="flex-1 overflow-y-auto p-3">
            <ul className="space-y-1">
              {room.members.map(member => (
                <li key={member.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-zinc-800/80 transition-colors cursor-default ${member.connected === false ? 'opacity-50' : ''}`}>
                  <div className="relative">
                    <div className="w-9 h-9 bg-zinc-800 border border-zinc-700 rounded-full flex items-center justify-center text-zinc-200 font-bold text-sm shadow-inner">
                      {member.nickname.charAt(0).toUpperCase()}
                    </div>
                    {/* Grey + pulsing while disconnected (mid reconnect-grace-window),
                        pink while actually connected — see the 'user-disconnected'/
                        'user-reconnected' handlers above for what flips this. */}
                    <div className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-zinc-900 rounded-full shadow-sm ${member.connected === false ? 'bg-zinc-500 animate-pulse' : 'bg-pink-500'}`}></div>
                  </div>
                  <span className="text-sm font-semibold text-zinc-200 truncate flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="truncate">{member.nickname}</span>
                    {member.isAdmin && <Crown size={13} className="text-pink-400 fill-pink-400/70 shrink-0" />}
                    {member.id === socket.id && <span className="text-zinc-500 font-normal shrink-0">(You)</span>}
                    {member.connected === false && member.id !== socket.id && (
                      <span className="text-zinc-500 font-normal shrink-0 text-[11px] italic">reconnecting…</span>
                    )}
                  </span>
                  {isHost && !member.isAdmin && member.id !== socket.id && (
                    <button
                      type="button"
                      onClick={() => handleKick(member)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                      title={`Remove ${member.nickname}`}
                    >
                      <UserX size={16} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {showSidebar && (
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10 md:hidden transition-opacity"
            onClick={() => setShowSidebar(false)}
          />
        )}
      </div>

      {showImageAdGate && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#151518] border border-white/10 rounded-[2rem] p-6 max-w-sm w-full text-center shadow-2xl"
          >
            <p className="text-xs uppercase tracking-widest text-zinc-500 mb-4">
              One quick ad before your photo
            </p>
            <TopAd />
            <button
              type="button"
              onClick={handleImageAdContinue}
              disabled={imageAdCountdown > 0}
              className="mt-6 w-full bg-gradient-to-r from-pink-500 to-fuchsia-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-full transition-all text-sm"
            >
              {imageAdCountdown > 0 ? `Continue in ${imageAdCountdown}s` : 'Continue to photo picker'}
            </button>
            <button
              type="button"
              onClick={() => setShowImageAdGate(false)}
              className="mt-3 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Cancel
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
