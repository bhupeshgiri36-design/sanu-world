import React from 'react';
import AdSlot from './AdSlot.jsx';
import { adService } from '../../services/adService.js';
import { useIsAdmin } from '../../context/AdminContext';

const SNIPPET = import.meta.env.VITE_SIDE_AD_SNIPPET || '';
const PROVIDER = import.meta.env.VITE_SIDE_AD_PROVIDER || 'adsterra';

export default function SideAd() {
  const isAdmin = useIsAdmin();
  const hide = isAdmin !== false;

  React.useEffect(() => {
    if (SNIPPET && !hide) adService.recordImpression(PROVIDER, 'side');
  }, [hide]);

  if (hide) return null;

  return (
    <AdSlot
      snippetHtml={SNIPPET}
      width="300px"
      height="600px"
      className="hidden xl:flex"
    />
  );
}
