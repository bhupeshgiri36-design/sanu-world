import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, KeyRound } from 'lucide-react';
import { motion } from 'motion/react';

export default function JoinRoom() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialCode = queryParams.get('code') || '';

  const [code, setCode] = useState(initialCode);
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(initialCode ? 2 : 1);

  useEffect(() => {
    if (initialCode) {
      checkRoom(initialCode);
    }
  }, [initialCode]);

  const checkRoom = async (roomCode) => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`/api/rooms/${roomCode}`);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Space not found or expired.');
      }

      setRequiresPassword(data.requiresPassword);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    checkRoom(code);
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (requiresPassword) {
        const res = await fetch(`/api/rooms/${code}/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });
        
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Invalid password');
        }
      }

      sessionStorage.setItem(`room_${code.toUpperCase()}`, JSON.stringify({ nickname, password }));
      navigate(`/room/${code.toUpperCase()}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D0D0F] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg h-[400px] bg-[#ff8bb3]/5 blur-[150px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <button 
          onClick={() => {
            if (step === 2 && !initialCode) {
              setStep(1);
              setError('');
            } else {
              navigate('/');
            }
          }}
          className="flex items-center gap-2 text-zinc-400 hover:text-white mb-8 transition-colors font-medium group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          {step === 2 && !initialCode ? 'Back' : 'Back to home'}
        </button>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#151518] p-10 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/5 backdrop-blur-xl text-center"
        >
          <div className="mb-8">
            <h2 className="text-3xl font-serif text-white mb-2 flex items-center justify-center gap-3 tracking-wide">
              <KeyRound className="text-[#f472b6]" />
              Join Private Space
            </h2>
            <p className="text-zinc-400 text-sm font-light">Use an invite link or code to enter.</p>
          </div>

          {error && (
            <div className="bg-red-500/10 text-red-400 p-4 rounded-xl text-sm mb-8 border border-red-500/20">
              {error}
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleNext} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Invite Code *
                </label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. A1B2C3"
                  className="w-full px-5 py-4 bg-[#0D0D0F] border border-zinc-800 rounded-2xl focus:outline-none focus:border-[#ff8bb3] text-white placeholder-zinc-600 transition-all uppercase text-center text-lg"
                  maxLength={6}
                />
                <p className="mt-3 text-xs text-zinc-500 font-light">Don't have a code? Try <button type="button" onClick={() => setCode('DEMO12')} className="text-[#ff8bb3] hover:underline font-medium">DEMO12</button></p>
              </div>
              <motion.button
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading || code.length < 6}
                className="w-full bg-white hover:bg-zinc-200 disabled:opacity-50 text-zinc-950 font-bold py-4 px-4 rounded-full transition-all mt-8 uppercase tracking-wider text-sm shadow-[0_5px_15px_rgba(255,255,255,0.1)]"
              >
                {loading ? 'Checking...' : 'Continue'}
              </motion.button>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Your Name *
                </label>
                <input
                  type="text"
                  required
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="e.g. Rahul"
                  className="w-full px-5 py-4 bg-[#0D0D0F] border border-zinc-800 rounded-2xl focus:outline-none focus:border-[#ff8bb3] text-white placeholder-zinc-600 transition-all text-center text-lg"
                  maxLength={20}
                />
              </div>

              {requiresPassword && (
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">
                    Space Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password required"
                    className="w-full px-5 py-4 bg-[#0D0D0F] border border-zinc-800 rounded-2xl focus:outline-none focus:border-[#ff8bb3] text-white placeholder-zinc-600 transition-all text-center text-lg"
                  />
                </div>
              )}

              <motion.button
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading || !nickname.trim() || (requiresPassword && !password)}
                className="w-full bg-gradient-to-r from-[#f472b6] to-[#ec4899] hover:from-[#ec4899] hover:to-[#db2777] disabled:opacity-50 text-white font-bold py-4 px-4 rounded-full transition-all mt-8 uppercase tracking-wider text-sm shadow-[0_10px_20px_rgba(236,72,153,0.3)]"
              >
                {loading ? 'Entering...' : 'Enter Space'}
              </motion.button>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}
