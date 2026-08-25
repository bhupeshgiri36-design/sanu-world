import React from 'react';
import { MessageCircle, Instagram, Send } from 'lucide-react';

const LINKS = [
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    href: import.meta.env.VITE_WHATSAPP_URL || 'https://wa.me/0000000000',
    Icon: MessageCircle,
    hoverColor: 'hover:text-[#25D366] hover:border-[#25D366]/40',
  },
  {
    key: 'instagram',
    label: 'Instagram',
    href: import.meta.env.VITE_INSTAGRAM_URL || 'https://instagram.com/your_handle',
    Icon: Instagram,
    hoverColor: 'hover:text-[#E1306C] hover:border-[#E1306C]/40',
  },
  {
    key: 'telegram',
    label: 'Telegram',
    href: import.meta.env.VITE_TELEGRAM_URL || 'https://t.me/your_handle',
    Icon: Send,
    hoverColor: 'hover:text-[#26A5E4] hover:border-[#26A5E4]/40',
  },
];

export default function SocialLinks({ className = '' }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {LINKS.map(({ key, label, href, Icon, hoverColor }) => (
        
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          className={`w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 transition-colors ${hoverColor}`}
        >
          <Icon size={18} />
        </a>
      ))}
    </div>
  );
}
