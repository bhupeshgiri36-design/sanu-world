import React from 'react';
import AdSlot from './AdSlot.jsx';
import { adService } from '../../services/adService.js';
import { useIsAdmin } from '../../context/AdminContext';
import useKeyboardOpen from '../../hooks/useKeyboardOpen';
 
const SNIPPET = import.meta.env.VITE_STICKY_AD_SNIPPET || '';
const PROVIDER = import.meta.env.VITE_STICKY_AD_PROVIDER || 'adsterra';
 
export default function StickyMobileAd() {
  const isAdmin = useIsAdmin();
  // This bar is `position: fixed` to the bottom of the layout viewport,
  // which doesn't move when the on-screen keyboard opens — left visible
  // it either sits on top of the keyboard or leaves a dead strip of space
  // where it used to be. Hide it for the duration of typing instead.
  const keyboardOpen = useKeyboardOpen();
  const hide = isAdmin !== false || keyboardOpen;
 
  React.useEffect(() => {
    if (SNIPPET && !hide) adService.recordImpression(PROVIDER, 'sticky_mobile');
  }, [hide]);
 
  if (hide) return null;
 
  return (
    <div className="xl:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0D0D0F]/95 backdrop-blur-md border-t border-white/10 flex items-center justify-center py-1.5 px-2">
      <AdSlot
        snippetHtml={SNIPPET}
        nativeWidth={320}
        nativeHeight={50}
      />
    </div>
  );
}
