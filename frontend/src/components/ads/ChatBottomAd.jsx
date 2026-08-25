import React from 'react';
import AdSlot from './AdSlot.jsx';
import { adService } from '../../services/adService.js';
import { useIsAdmin } from '../../context/AdminContext';

// Slim banner placed directly above the message input inside the chat
// room. Deliberately NOT sticky/fixed — it sits in normal document flow
// as a fixed row just above the input bar, so it never fights
// StickyMobileAd (which is mounted globally on Landing) for the same
// screen real estate, and it never covers or interrupts the message
// list itself.
const SNIPPET = import.meta.env.VITE_CHAT_BOTTOM_AD_SNIPPET || '';
const PROVIDER = import.meta.env.VITE_CHAT_BOTTOM_AD_PROVIDER || 'adsterra';

export default function ChatBottomAd() {
  const isAdmin = useIsAdmin();
  const hide = isAdmin !== false;

  React.useEffect(() => {
    if (SNIPPET && !hide) adService.recordImpression(PROVIDER, 'chat_bottom');
  }, [hide]);

  if (hide) return null;

  return (
    <div className="w-full border-t border-white/5 bg-[#0D0D0F] flex items-center justify-center py-1.5 px-2">
      <AdSlot
        snippetHtml={SNIPPET}
        nativeWidth={320}
        nativeHeight={50}
      />
    </div>
  );
}
