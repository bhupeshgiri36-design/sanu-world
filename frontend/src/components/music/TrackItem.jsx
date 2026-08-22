// frontend/src/components/music/TrackItem.jsx

import React from 'react';
import { Music as MusicIcon } from 'lucide-react';

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function TrackItem({ track, onSelect }) {
  return (
    <li className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-zinc-800/80 transition-colors">
      <div className="w-10 h-10 rounded-lg bg-zinc-800 overflow-hidden shrink-0 flex items-center justify-center">
        {track.artwork ? (
          <img src={track.artwork} alt={track.title} className="w-full h-full object-cover" />
        ) : (
          <MusicIcon size={16} className="text-zinc-500" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-zinc-100 truncate">{track.title}</p>
        <p className="text-xs text-zinc-500 truncate">{track.artist}</p>
      </div>

      <span className="text-[11px] text-zinc-600 font-mono shrink-0">
        {formatDuration(track.duration)}
      </span>

      <button
        type="button"
        onClick={() => onSelect(track)}
        className="text-xs font-bold text-pink-400 hover:text-pink-300 px-3 py-1.5 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 transition-colors shrink-0"
      >
        Select
      </button>
    </li>
  );
}