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

  if (hide) return null;

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
