import React from 'react';
import AdSlot from './AdSlot.jsx';
import { adService } from '../../services/adService.js';
import { useIsAdmin } from '../../context/AdminContext';
 
const SNIPPET = import.meta.env.VITE_STICKY_AD_SNIPPET || '';
const PROVIDER = import.meta.env.VITE_STICKY_AD_PROVIDER || 'adsterra';
 
export default function StickyMobileAd() {
  const isAdmin = useIsAdmin();
  const hide = isAdmin !== false;
 
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
