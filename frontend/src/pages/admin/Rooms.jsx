import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, CheckCircle2, XCircle, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { API_ORIGIN } from '../../lib/config';

export default function Rooms() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [stats, setStats] = useState({ activeRooms: 0 });
  const [copiedId, setCopiedId] = useState(null);
  
  // Create Room State
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [maxMembers, setMaxMembers] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      const statsRes = await fetch(`${API_ORIGIN}/api/admin/stats`, { credentials: 'include' });
      if (statsRes.ok) setStats(await statsRes.json());

      const roomsRes = await fetch(`${API_ORIGIN}/api/admin/rooms`, { credentials: 'include' });
      if (roomsRes.ok) setRooms(await roomsRes.json());
    } catch (err) {
      console.error("Failed to fetch rooms data");
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleCloseRoom = async (code) => {
    if (!window.confirm("Are you sure you want to close this room? All users will be disconnected.")) return;
    try {
      await fetch(`${API_ORIGIN}/api/admin/rooms/${code}/close`, { method: 'POST', credentials: 'include' });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopyLink = (code) => {
    const url = `${window.location.origin}/room/${code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(code);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_ORIGIN}/api/admin/rooms/create`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, nickname, password, maxMembers: parseInt(maxMembers) }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create room');
      }

      sessionStorage.setItem(`room_${data.code}`, JSON.stringify({ nickname, password }));
      
      // Navigate directly to the room.
      navigate(`/room/${data.code}`);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto"
    >
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-extrabold text-white tracking-wide">Rooms</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Rooms List */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-xl font-bold text-white mb-2">Live Rooms ({rooms.length})</h3>
          {rooms.length === 0 ? (
            <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-8 text-center text-zinc-500 backdrop-blur-sm">
              No active rooms. Create one to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {rooms.map(room => (
                <div key={room.code} className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5 backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h4 className="font-bold text-white text-lg">{room.name}</h4>
                      <span className="text-xs font-mono bg-zinc-800 px-2 py-0.5 rounded text-zinc-300">#{room.code}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                      <Users size={14} className="text-pink-400" />
                      <span>{room.members} / {room.maxMembers} members</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => handleCopyLink(room.code)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 rounded-xl text-sm font-semibold transition-colors border border-zinc-700"
                    >
                      {copiedId === room.code ? <CheckCircle2 size={16} className="text-pink-400" /> : <Copy size={16} />}
                      {copiedId === room.code ? 'Copied' : 'Invite Link'}
                    </button>
                    <button
                      onClick={() => handleCloseRoom(room.code)}
                      className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors shrink-0"
                      title="End Session"
                    >
                      <XCircle size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Room Form */}
        <div className="bg-zinc-900/70 p-8 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-pink-500/20 backdrop-blur-xl h-fit">
          <h3 className="text-xl font-bold text-white mb-6">Create New Room</h3>
          
          {error && (
            <div className="bg-red-500/10 text-red-400 p-4 rounded-xl text-sm mb-6 border border-red-500/20">
              {error}
            </div>
          )}

          {stats.activeRooms >= 5 ? (
            <div className="bg-zinc-800/50 border border-zinc-700 p-6 rounded-xl text-center">
              <p className="text-zinc-400 text-sm font-medium">
                Max active rooms reached (5/5). Close a room to create a new one.
              </p>
            </div>
          ) : (
            <form onSubmit={handleCreateRoom} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-zinc-300 mb-2 uppercase">Space Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sanu & Friends"
                  className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 text-white placeholder-zinc-600 transition-all text-sm shadow-inner"
                  maxLength={30}
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-zinc-300 mb-2 uppercase">Your Nickname *</label>
                <input
                  type="text"
                  required
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="e.g. Sanu"
                  className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 text-white placeholder-zinc-600 transition-all text-sm shadow-inner"
                  maxLength={20}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-zinc-300 mb-2 uppercase">Max Capacity *</label>
                <input
                  type="number"
                  required
                  min={2}
                  max={50}
                  value={maxMembers}
                  onChange={(e) => setMaxMembers(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 text-white placeholder-zinc-600 transition-all text-sm shadow-inner"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-zinc-300 mb-2 uppercase">Password <span className="text-zinc-500 font-medium normal-case">(Optional)</span></label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Leave blank for link-only"
                  className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 text-white placeholder-zinc-600 transition-all text-sm shadow-inner"
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.05, y: -2, rotate: -1 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading || !name.trim() || !nickname.trim() || !maxMembers}
                className="w-full bg-gradient-to-r from-pink-500 to-fuchsia-500 hover:from-pink-400 hover:to-fuchsia-400 disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-xl transition-all duration-300 mt-6 shadow-[0_10px_20px_rgba(236,72,153,0.3)] hover:shadow-[0_15px_30px_rgba(236,72,153,0.5)] text-sm"
              >
                {loading ? 'Creating...' : 'Create Room'}
              </motion.button>
            </form>
          )}
        </div>
      </div>
    </motion.div>
  );
}
