// frontend/src/components/music/MusicPlayer.jsx
//
// Step 5.3 scope ONLY: local playback of a single selected track.
// No Socket.IO, no room state, no synchronization — that's Step 5.5+.
// This component doesn't know or care that a "room" exists; it just plays
// whatever track it's given, driven entirely by the native <audio> element.

import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Music as MusicIcon, AlertCircle } from 'lucide-react';

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function MusicPlayer({ track }) {
  const audioRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'ready' | 'error'
  const [artworkFailed, setArtworkFailed] = useState(false);

  // Load a new track whenever it changes. Per requirement #5: stop the old
  // track, reset position, load the new one, and do NOT force playback —
  // browsers block unsolicited autoplay, and a failed autoplay attempt
  // shouldn't look like a broken player.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setArtworkFailed(false);

    if (!track || !track.streamUrl) {
      setStatus('idle');
      audio.removeAttribute('src');
      audio.load();
      return;
    }

    setStatus('loading');
    audio.src = track.streamUrl;
    audio.load();
    // Deliberately not calling audio.play() here — see comment above.
  }, [track?.id, track?.streamUrl]);

  // Keep the <audio> element's volume/mute in sync with local UI state.
  // Per requirement #12, this is 100% local — never broadcast anywhere.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = isMuted;
  }, [volume, isMuted]);

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setDuration(audio.duration || 0);
    setStatus('ready');
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

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || status === 'error' || !track) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      // play() returns a promise that rejects if the browser blocks it
      // (e.g. no prior user interaction). Since this only runs from a
      // click, that's already satisfied — but we still guard the promise
      // so a rejection can't throw an unhandled error into the console.
      audio.play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          setIsPlaying(false);
          setStatus('error');
        });
    }
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const newTime = Number(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (e) => {
    const newVolume = Number(e.target.value);
    setVolume(newVolume);
    if (newVolume > 0 && isMuted) setIsMuted(false);
  };

  const toggleMute = () => setIsMuted((m) => !m);

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

          {/* Progress bar */}
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
              disabled={status !== 'ready' && status !== 'error' ? status === 'loading' : false}
              className="flex-1 h-1.5 rounded-full appearance-none bg-zinc-800 accent-pink-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: `linear-gradient(to right, #ec4899 ${progressPercent}%, #27272a ${progressPercent}%)`,
              }}
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
              disabled={status === 'loading'}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-fuchsia-600 hover:from-pink-400 hover:to-fuchsia-500 disabled:opacity-50 disabled:cursor-not-allowed text-white flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(236,72,153,0.3)] transition-all"
              title={isPlaying ? 'Pause' : 'Play'}
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