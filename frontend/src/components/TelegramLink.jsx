import React from 'react';
import { Send } from 'lucide-react';
import { motion } from 'motion/react';

// Real Telegram link — separate from SponsoredLink (the Adsterra earning
// link) on purpose. Never merge these into one button; that's what makes
// a sponsored link deceptive.
const TELEGRAM_URL = 'https://t.me/Sanu4042';

export default function TelegramLink({ className = '', variant = 'solid' }) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-all';

  const styles =
    variant === 'solid'
      ? 'bg-[#26A5E4] hover:bg-[#1e8fc9] text-white px-6 py-2.5 text-sm shadow-[0_10px_30px_rgba(38,165,228,0.3)] hover:shadow-[0_15px_40px_rgba(38,165,228,0.4)]'
      : 'bg-transparent border border-[#26A5E4]/60 hover:border-[#26A5E4] text-[#26A5E4] px-8 py-3.5';

  return (
    <motion.a
      href={TELEGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
      whileHover={{ scale: 1.05, y: -2 }}
      whileTap={{ scale: 0.95 }}
      className={`${base} ${styles} ${className}`}
    >
      <Send size={16} /> Telegram
    </motion.a>
  );
}
