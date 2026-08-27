import React from 'react';
import AdSlot from './AdSlot.jsx';
import { adService } from '../../services/adService.js';
import { useIsAdmin } from '../../context/AdminContext';

const SNIPPET = import.meta.env.VITE_MID_AD_SNIPPET || '';
const PROVIDER = import.meta.env.VITE_MID_AD_PROVIDER || 'adsterra';

export default function MidAd({ refreshSeconds }) {
  const isAdmin = useIsAdmin();
  const hide = isAdmin !== false;

  React.useEffect(() => {
    if (SNIPPET && !hide) adService.recordImpression(PROVIDER, 'mid');
  }, [hide]);

  // No snippet configured yet — render nothing instead of an empty
  // "SPONSORED" placeholder box, same fix as Top/Bottom/Native/Side.
  if (hide || !SNIPPET) return null;

  return (
    <AdSlot
      snippetHtml={SNIPPET}
      nativeWidth={320}
      nativeHeight={300}
      className="w-full my-4"
      label="SPONSORED"
      refreshSeconds={refreshSeconds}
    />
  );
}
