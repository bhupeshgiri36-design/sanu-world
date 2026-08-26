import React from 'react';
import AdSlot from './AdSlot.jsx';
import { adService } from '../../services/adService.js';
import { useIsAdmin } from '../../context/AdminContext';

// 160x300 skyscraper — was an Adsterra dashboard zone with no component
// pointed at it. Lives in the ChatRoom Members sidebar, which is 256px
// wide (w-64), so a 160px-wide unit fits with room to spare either side.
const SNIPPET = import.meta.env.VITE_SKYSCRAPER_AD_SNIPPET || '';
const PROVIDER = import.meta.env.VITE_SKYSCRAPER_AD_PROVIDER || 'adsterra';

export default function SkyscraperAd() {
  const isAdmin = useIsAdmin();
  const hide = isAdmin !== false;

  React.useEffect(() => {
    if (SNIPPET && !hide) adService.recordImpression(PROVIDER, 'skyscraper');
  }, [hide]);

  if (hide || !SNIPPET) return null;

  return (
    <div className="w-full flex items-center justify-center py-3 border-b border-zinc-800">
      <AdSlot
        snippetHtml={SNIPPET}
        nativeWidth={160}
        nativeHeight={300}
        label="SPONSORED"
      />
    </div>
  );
}
