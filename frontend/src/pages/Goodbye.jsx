// frontend/src/pages/Goodbye.jsx

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { motion } from 'motion/react';
import TopAd from '../components/ads/TopAd';
import BottomAd from '../components/ads/BottomAd';
import MidAd from '../components/ads/MidAd';
import StickyMobileAd from '../components/ads/StickyMobileAd';
import PopunderAd from '../components/ads/PopunderAd';
import SponsoredLink from '../components/ads/SponsoredLink';

const TELEGRAM_URL = 'https://tpi.li/mytelegramid';

export default function Goodbye() {
  const navigate = useNavigate();
  const location = useLocation();

  // ChatRoom.jsx can pass a reason via navigate('/goodbye', { state: { reason } });
  // falls back to a generic message if someone lands here directly.
  const reason = location.state?.reason || 'Sanu has ended the chat';

  return (
    <div className="min-h-screen bg-[#0D0D0F] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg h-[400px] bg-[#ff8bb3]/5 blur-[150px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-[#151518] p-10 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] max-w-md w-full text-center border border-white/5 backdrop-blur-xl flex flex-col items-center relative z-10"
      >
        <div className="text-[#f472b6] mb-6">
          <Heart size={48} className="fill-[#f472b6]" />
        </div>
        <h2 className="text-2xl font-serif text-white mb-4 tracking-wide">
          {reason}
        </h2>
        <p className="text-zinc-400 mb-8 font-light">
          Thanks for connecting with Sanu. We hope to see you again on Sanu World.
        </p>

        {/* Only rendered for friends — TopAd hides itself automatically
            if this is ever loaded in an admin browser session. */}
        <div className="w-full mb-8">
          <TopAd />
        </div>

        <a
          href={TELEGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full mb-4 bg-[#26A5E4] hover:bg-[#1e8fc9] text-white font-bold py-3 px-8 rounded-full transition-colors shadow-[0_5px_15px_rgba(38,165,228,0.3)] text-sm tracking-wider uppercase flex items-center justify-center gap-2"
        >
          Message Sanu on Telegram
        </a>

        <button
          onClick={() => navigate('/')}
          className="bg-white hover:bg-zinc-200 text-zinc-950 font-bold py-3 px-8 rounded-full transition-colors shadow-[0_5px_15px_rgba(255,255,255,0.1)] text-sm tracking-wider uppercase"
        >
          Back to Sanu World
        </button>

        <div className="mt-6 w-full">
          <BottomAd />
        </div>

        <div className="mt-2">
          <SponsoredLink />
        </div>

        <div className="mt-6 w-full">
          <MidAd />
        </div>
      </motion.div>

      {/* Safe to mount here (no text inputs on this page — unlike JoinRoom,
          the "typing sends me to another page" bug can't happen). */}
      <PopunderAd />
      <StickyMobileAd />
    </div>
  );
}
