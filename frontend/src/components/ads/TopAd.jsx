import React from 'react';
import AdSlot from './AdSlot.jsx';
import { adService } from '../../services/adService.js';
import { useIsAdmin } from '../../context/AdminContext';

const SNIPPET = import.meta.env.VITE_TOP_AD_SNIPPET || '';
const PROVIDER = import.meta.env.VITE_TOP_AD_PROVIDER || 'adsterra';

export default function TopAd({ refreshSeconds }) {
  const isAdmin = useIsAdmin();
  const hide = isAdmin !== false;

  React.useEffect(() => {
    if (SNIPPET && !hide) adService.recordImpression(PROVIDER, 'top');
  }, [hide]);

  // No snippet configured yet — render nothing instead of an empty
  // "ADVERTISEMENT" placeholder box. Leaving the box mounted with no
  // creative is exactly what produces a dead rectangular gap in the
  // layout (this is the top-of-chat / top-of-join-form gap).
  if (hide || !SNIPPET) return null;

  return (
    <AdSlot
      snippetHtml={SNIPPET}
      nativeWidth={728}
      nativeHeight={90}
      className="my-3"
      refreshSeconds={refreshSeconds}
    />
  );
}
