// frontend/src/components/music/MusicSearch.jsx
//
// Step 5.2/5.5 scope: search box + results only.
// Per 5.16, only the host (Sanu) gets this control — the visitor should
// never see a search UI. Selecting a track just calls onSelectTrack up to
// the parent for now; broadcasting the selection to the room via socket
// (with backend host verification) is Step 5.6+, not built here.

import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { searchTracks } from '../../services/musicService';
import TrackItem from './TrackItem';

const DEBOUNCE_MS = 400;

export default function MusicSearch({ isHost, onSelectTrack }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setError('');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    debounceRef.current = setTimeout(async () => {
      // Guards against an older, slower request overwriting a newer result
      // if responses arrive out of order.
      const thisRequestId = ++requestIdRef.current;
      try {
        const tracks = await searchTracks(trimmed);
        if (requestIdRef.current === thisRequestId) {
          setResults(tracks);
        }
      } catch (err) {
        if (requestIdRef.current === thisRequestId) {
          setError('Music service temporarily unavailable');
          setResults([]);
        }
      } finally {
        if (requestIdRef.current === thisRequestId) {
          setLoading(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Per 5.16, search is host-only. Enforced here for the UI (the backend
  // route itself is read-only/harmless either way, so no server-side host
  // check is needed for search specifically — only for play/pause/change
  // in later steps, which actually mutate room state).
  if (!isHost) return null;

  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl focus-within:border-pink-500/50 transition-colors">
        <Search size={16} className="text-zinc-500 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search music..."
          className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-600 outline-none min-w-0"
        />
        {loading && <Loader2 size={14} className="text-pink-400 animate-spin shrink-0" />}
      </div>

      {error && (
        <p className="text-xs text-red-400 px-2">{error}</p>
      )}

      {!error && query.trim() && !loading && results.length === 0 && (
        <p className="text-xs text-zinc-600 px-2">No tracks found.</p>
      )}

      {results.length > 0 && (
         <ul className="max-h-56 overflow-y-auto space-y-0.5 overscroll-contain">
          {results.map((track) => (
            <TrackItem key={track.id} track={track} onSelect={onSelectTrack} />
          ))}
        </ul>
      )}
    </div>
  );
}