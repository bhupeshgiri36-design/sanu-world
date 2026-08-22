import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }
      
      navigate('/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg h-[400px] bg-pink-600/10 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="w-full max-w-md relative z-10">
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-zinc-400 hover:text-white mb-8 transition-colors font-medium group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          Back to home
        </button>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900/70 p-10 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-pink-500/20 backdrop-blur-xl"
        >
          <div className="mb-8 text-center">
            <h3 className="font-serif text-xl tracking-wide text-white opacity-60 mb-2">SANU WORLD</h3>
            <h2 className="text-2xl font-extrabold text-white mb-2 flex items-center justify-center gap-3 tracking-wide">
              <Lock className="text-pink-500" />
              ADMIN LOGIN
            </h2>
          </div>

          {error && (
            <div className="bg-red-500/10 text-red-400 p-4 rounded-xl text-sm mb-8 border border-red-500/20 text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sanu@example.com"
                className="w-full px-5 py-3.5 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:border-pink-500 text-white placeholder-zinc-600 transition-all shadow-inner"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-5 py-3.5 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:border-pink-500 text-white placeholder-zinc-600 transition-all shadow-inner"
              />
            </div>
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-pink-500 to-fuchsia-500 hover:from-pink-400 hover:to-fuchsia-400 disabled:opacity-50 text-white font-bold py-4 px-4 rounded-xl transition-all duration-300 mt-4 shadow-[0_10px_20px_rgba(236,72,153,0.3)] hover:shadow-[0_15px_30px_rgba(236,72,153,0.5)] tracking-wider"
            >
              {loading ? 'Authenticating...' : 'LOGIN'}
            </motion.button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
