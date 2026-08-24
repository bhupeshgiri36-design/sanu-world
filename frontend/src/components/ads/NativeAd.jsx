import React from 'react';
import AdSlot from './AdSlot.jsx';
import { adService } from '../../services/adService.js';
import { useIsAdmin } from '../../context/AdminContext';

const SNIPPET = import.meta.env.VITE_NATIVE_AD_SNIPPET || '';
const PROVIDER = import.meta.env.VITE_NATIVE_AD_PROVIDER || 'adsterra';

export default function NativeAd() {
  const isAdmin = useIsAdmin();
  const hide = isAdmin !== false;

  React.useEffect(() => {
    if (SNIPPET && !hide) adService.recordImpression(PROVIDER, 'native');
  }, [hide]);

  if (hide) return null;

  return <AdSlot snippetHtml={SNIPPET} width="100%" className="w-full my-4" label="SPONSORED" />;
}
