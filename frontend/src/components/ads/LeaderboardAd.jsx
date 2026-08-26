import React from 'react';
import AdSlot from './AdSlot.jsx';
import { adService } from '../../services/adService.js';
import { useIsAdmin } from '../../context/AdminContext';

// 468x60 leaderboard — was an Adsterra dashboard zone with no component
// pointed at it. Lives on JoinRoom step 1 (the invite-code entry screen),
// which previously showed zero ads at all — Top/Bottom only mount at
// step 2, after a valid code is entered.
const SNIPPET = import.meta.env.VITE_LEADERBOARD_AD_SNIPPET || '';
const PROVIDER = import.meta.env.VITE_LEADERBOARD_AD_PROVIDER || 'adsterra';

export default function LeaderboardAd() {
  const isAdmin = useIsAdmin();
  const hide = isAdmin !== false;

  React.useEffect(() => {
    if (SNIPPET && !hide) adService.recordImpression(PROVIDER, 'leaderboard');
  }, [hide]);

  if (hide || !SNIPPET) return null;

  return (
    <div className="w-full flex items-center justify-center mb-6">
      <AdSlot
        snippetHtml={SNIPPET}
        nativeWidth={468}
        nativeHeight={60}
        label="SPONSORED"
      />
    </div>
  );
}
