import React, { useState, useEffect } from 'react';
import { Activity, Users, MessageSquare } from 'lucide-react';
import { motion } from 'motion/react';
import { API_ORIGIN } from '../../lib/config';

export default function Dashboard() {
  const [stats, setStats] = useState({ activeRooms: 0, totalOnline: 0, totalMessages: 0 });

  const fetchDashboardData = async () => {
    try {
      const statsRes = await fetch(`${API_ORIGIN}/api/admin/stats`, { credentials: 'include' });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data", err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto"
    >
      <h1 className="text-3xl font-extrabold text-white mb-8 tracking-wide">Overview</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-zinc-900/70 p-6 rounded-2xl border border-zinc-800/50 backdrop-blur-md shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-zinc-400 text-sm font-medium">Active Rooms</p>
            <p className="text-2xl font-bold text-white">{stats.activeRooms} / 5</p>
          </div>
        </div>
        <div className="bg-zinc-900/70 p-6 rounded-2xl border border-zinc-800/50 backdrop-blur-md shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-fuchsia-500/20 text-fuchsia-400 flex items-center justify-center">
            <Users size={24} />
          </div>
          <div>
            <p className="text-zinc-400 text-sm font-medium">Total Online</p>
            <p className="text-2xl font-bold text-white">{stats.totalOnline}</p>
          </div>
        </div>
        <div className="bg-zinc-900/70 p-6 rounded-2xl border border-zinc-800/50 backdrop-blur-md shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
            <MessageSquare size={24} />
          </div>
          <div>
            <p className="text-zinc-400 text-sm font-medium">Total Messages</p>
            <p className="text-2xl font-bold text-white">{stats.totalMessages}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-8 text-center text-zinc-500 backdrop-blur-sm">
        <p>Recent session history will appear here.</p>
      </div>
    </motion.div>
  );
}
