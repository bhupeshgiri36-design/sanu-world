// frontend/src/components/music/MusicPlayer.jsx
//
// Real cross-client sync, driven entirely by the server's `track` object
// (room.music from the 'music-update' socket event): { streamUrl, title,
// artist, artwork, id, playing, position, timestamp }. `position` is
// "seconds into the track" as of `timestamp` (a server Date.now()) — the
// friend's client derives "where the track should be right now" as
// `position + (Date.now() - timestamp) / 1000` while playing, and just
// `position` while paused. That's what makes two different clocks (Sanu's
// tab and the friend's tab) land on the same spot in the song, instead of
// each side just playing from wherever IT happened to click play.
//
// Sanu (isHost=true) drives playback locally like a normal player, and
// every play/pause/seek also calls onPlay/onPause/onSeek so ChatRoom.jsx
// can broadcast it over the socket. The friend (isHost=false) never
// controls playback directly — their player is a mirror: a `useEffect`
// below watches `track.playing`/`position`/`timestamp` and adjusts the
// local <audio> element to match, correcting drift and flipping
// play/pause as needed.

import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Music as MusicIcon, AlertCircle, RadioTower } from 'lucide-react';

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// How far local playback is allowed to drift from the server-derived
// target before we hard-correct it. Too small and tiny network jitter
// causes constant micro-seeks (audible stutter); too large and the two
// sides visibly disagree on where the song is.
const DRIFT_CORRECTION_THRESHOLD_S = 1.2;

// While playing, how often the guest side re-checks for drift against the
// server's position/timestamp — not just on every 'music-update' event
// (which only fires on play/pause/seek/track-change), so a long-playing
// track doesn't slowly drift apart between those events.
const RESYNC_INTERVAL_MS = 4000;

export default function MusicPlayer({ track, isHost = false, onPlay, onPause, onSeek }) {
  const audioRef = useRef(null);
  const readyRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'ready' | 'error'
  const [artworkFailed, setArtworkFailed] = useState(false);

  // Guests only: true when the browser blocked our attempt to
  // programmatically start playback (autoplay policy) because this tab
  // hasn't seen a genuine user gesture yet. Shows a small "Tap to sync"
  // button — one real click unlocks audio.play() for the rest of the tab's
  // session.
  const [needsTapToSync, setNeedsTapToSync] = useState(false);

  const targetPositionFor = (t) => {
    if (!t) return 0;
    const base = t.position || 0;
    if (!t.playing) return base;
    return base + (Date.now() - (t.timestamp || Date.now())) / 1000;
  };

  // Load a new track whenever it changes. Stop the old one, reset
  // position, load the new one, and don't force playback here — the sync
  // effect below (or the host's own click) is what actually starts it.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setArtworkFailed(false);
    setNeedsTapToSync(false);
    readyRef.current = false;

    if (!track || !track.streamUrl) {
      setStatus('idle');
      audio.removeAttribute('src');
      audio.load();
      return;
    }

    setStatus('loading');
    audio.src = track.streamUrl;
    audio.load();
  }, [track?.id, track?.streamUrl]);

  // Keep the <audio> element's volume/mute in sync with local UI state.
  // 100% local — never broadcast to the other side.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = isMuted;
  }, [volume, isMuted]);

  // GUEST SYNC — the actual fix. Whenever the server's playing/position/
  // timestamp changes (a new 'music-update' arrived), jump this audio
  // element to the correct spot and mirror play/pause. The host is
  // excluded: their own clicks already drive their player directly, and
  // re-syncing the host to itself would fight their own scrubbing.
  const attemptSync = () => {
    if (isHost) return;
    const audio = audioRef.current;
    if (!audio || !track?.streamUrl || !readyRef.current) return;

    const target = Math.max(0, targetPositionFor(track));

    if (Math.abs(audio.currentTime - target) > DRIFT_CORRECTION_THRESHOLD_S) {
      audio.currentTime = target;
    }

    if (track.playing && audio.paused) {
      audio.play()
        .then(() => {
          setIsPlaying(true);
          setNeedsTapToSync(false);
        })
        .catch(() => {
          // Autoplay blocked — this tab needs one real tap before the
          // browser will let JS start audio. Show the prompt instead of
          // silently doing nothing (which is what "music not syncing"
          // looked like before).
          setNeedsTapToSync(true);
        });
    } else if (!track.playing && !audio.paused) {
      audio.pause();
      setIsPlaying(false);
    }
  };

  useEffect(() => {
    attemptSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, track?.playing, track?.position, track?.timestamp, status]);

  // Periodic drift correction while the guest's copy is playing — catches
  // slow clock/network drift between the events above.
  useEffect(() => {
    if (isHost || !track?.playing) return;
    const id = setInterval(attemptSync, RESYNC_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, track?.playing, track?.position, track?.timestamp]);

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setDuration(audio.duration || 0);
    setStatus('ready');
    readyRef.current = true;
    // As soon as we know the track is actually loaded, guests should
    // immediately snap to wherever the server says the song is — rather
    // than starting from 0 and waiting for the next 'music-update'.
    if (!isHost) attemptSync();
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleError = () => {
    setStatus('error');
    setIsPlaying(false);
  };

  // Playback controls below only ever run for the host — guests are
  // read-only and are driven entirely by the sync effect above.
  const togglePlay = () => {
    if (!isHost) return;
    const audio = audioRef.current;
    if (!audio || status === 'error' || !track) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      onPause?.(audio.currentTime);
    } else {
      audio.play()
        .then(() => {
          setIsPlaying(true);
          onPlay?.(audio.currentTime);
        })
        .catch(() => {
          setIsPlaying(false);
          setStatus('error');
        });
    }
  };

  const handleSeek = (e) => {
    if (!isHost) return;
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const newTime = Number(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
    onSeek?.(newTime);
  };

  const handleVolumeChange = (e) => {
    const newVolume = Number(e.target.value);
    setVolume(newVolume);
    if (newVolume > 0 && isMuted) setIsMuted(false);
  };

  const toggleMute = () => setIsMuted((m) => !m);

  // Guest tapping the "Tap to sync" prompt — this IS a genuine user
  // gesture, so audio.play() is allowed here even if the earlier
  // programmatic attempt was blocked.
  const handleTapToSync = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, targetPositionFor(track));
    audio.play()
      .then(() => {
        setIsPlaying(true);
        setNeedsTapToSync(false);
      })
      .catch(() => {
        // Still blocked for some other reason — leave the prompt up.
      });
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-3">
      {/* The actual audio element — hidden, driven entirely by state above */}
      <audio
        ref={audioRef}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={handleError}
        preload="metadata"
      />

      {!track ? (
        <div className="flex items-center gap-3 text-zinc-600 py-2">
          <MusicIcon size={20} />
          <span className="text-sm">No track selected</span>
        </div>
      ) : (
        <>
          {/* Track info */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-zinc-800 overflow-hidden shrink-0 flex items-center justify-center">
              {track.artwork && !artworkFailed ? (
                <img
                  src={track.artwork}
                  alt={track.title}
                  className="w-full h-full object-cover"
                  onError={() => setArtworkFailed(true)}
                />
              ) : (
                <MusicIcon size={18} className="text-zinc-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-zinc-100 truncate">{track.title || 'Unknown track'}</p>
              <p className="text-xs text-zinc-500 truncate">{track.artist || 'Unknown artist'}</p>
            </div>
          </div>

          {status === 'error' && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>This track is unavailable. Try selecting another one.</span>
            </div>
          )}

          {needsTapToSync && (
            <button
              type="button"
              onClick={handleTapToSync}
              className="flex items-center justify-center gap-2 text-xs font-semibold text-pink-300 bg-pink-500/10 border border-pink-500/20 rounded-lg px-3 py-2 hover:bg-pink-500/20 transition-colors"
            >
              <RadioTower size={14} />
              Tap to sync with Sanu
            </button>
          )}

          {/* Progress bar — draggable for the host, read-only display for guests */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-500 font-mono w-9 text-right shrink-0">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={Math.min(currentTime, duration || 0)}
              onChange={handleSeek}
              disabled={!isHost || status === 'loading'}
              className="flex-1 h-1.5 rounded-full appearance-none bg-zinc-800 accent-pink-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: `linear-gradient(to right, #ec4899 ${progressPercent}%, #27272a ${progressPercent}%)`,
              }}
              title={isHost ? undefined : "Sanu controls playback"}
            />
            <span className="text-[11px] text-zinc-500 font-mono w-9 shrink-0">
              {formatTime(duration)}
            </span>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={togglePlay}
              disabled={status === 'loading' || !isHost}
              title={isHost ? (isPlaying ? 'Pause' : 'Play') : 'Sanu controls playback'}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-fuchsia-600 hover:from-pink-400 hover:to-fuchsia-500 disabled:opacity-50 disabled:cursor-not-allowed text-white flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(236,72,153,0.3)] transition-all"
            >
              {status === 'loading' ? (
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : isPlaying ? (
                <Pause size={18} className="fill-white" />
              ) : (
                <Play size={18} className="fill-white ml-0.5" />
              )}
            </button>

            <div className="flex items-center gap-2 flex-1 max-w-[140px]">
              <button
                type="button"
                onClick={toggleMute}
                className="text-zinc-400 hover:text-zinc-200 transition-colors shrink-0"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="flex-1 h-1.5 rounded-full appearance-none bg-zinc-800 accent-pink-500 cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #ec4899 ${(isMuted ? 0 : volume) * 100}%, #27272a ${(isMuted ? 0 : volume) * 100}%)`,
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
