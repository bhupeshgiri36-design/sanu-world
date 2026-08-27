import React from 'react';
import AdSlot from './AdSlot.jsx';
import { adService } from '../../services/adService.js';
import { useIsAdmin } from '../../context/AdminContext';

const SNIPPET = import.meta.env.VITE_SIDE_AD_SNIPPET || '';
const PROVIDER = import.meta.env.VITE_SIDE_AD_PROVIDER || 'adsterra';

export default function SideAd({ refreshSeconds }) {
  const isAdmin = useIsAdmin();
  const hide = isAdmin !== false;

  React.useEffect(() => {
    if (SNIPPET && !hide) adService.recordImpression(PROVIDER, 'side');
  }, [hide]);

  // No snippet configured yet — render nothing instead of an empty
  // placeholder rail, same fix as Top/Bottom/Mid/Native.
  if (hide || !SNIPPET) return null;

  return (
    <div className="hidden xl:flex w-[160px]">
      <AdSlot snippetHtml={SNIPPET} nativeWidth={160} nativeHeight={600} refreshSeconds={refreshSeconds} />
    </div>
  );
}
