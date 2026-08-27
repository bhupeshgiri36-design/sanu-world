import React from 'react';
import AdSlot from './AdSlot.jsx';
import { adService } from '../../services/adService.js';
import { useIsAdmin } from '../../context/AdminContext';

const SNIPPET = import.meta.env.VITE_NATIVE_AD_SNIPPET || '';
const PROVIDER = import.meta.env.VITE_NATIVE_AD_PROVIDER || 'adsterra';

export default function NativeAd({ refreshSeconds }) {
  const isAdmin = useIsAdmin();
  const hide = isAdmin !== false;

  React.useEffect(() => {
    if (SNIPPET && !hide) adService.recordImpression(PROVIDER, 'native');
  }, [hide]);

  // No snippet configured yet — render nothing instead of an empty
  // "SPONSORED" placeholder box. This one sits inline in the message
  // feed every 10 messages, so an empty box here reads as a broken
  // message rather than "an ad is loading".
  if (hide || !SNIPPET) return null;

  // Native banners self-size to fill their container — they aren't a
  // fixed pixel creative like the top/bottom/side banners. AdSlot only
  // understands nativeWidth/nativeHeight (the old `width="100%"` prop
  // here didn't exist on AdSlot, so it was silently ignored and every
  // native ad was getting clipped to AdSlot's 300x250 banner default).
  // 320x300 matches Adsterra's native banner container recommendation
  // and reads fine full-width on mobile.
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
