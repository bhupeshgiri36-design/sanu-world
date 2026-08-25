import React from 'react';
import { useIsAdmin } from '../../context/AdminContext';

const URL = import.meta.env.VITE_ADSTERRA_DIRECT_LINK || '';

// A normal <a target="_blank"> link, clearly labeled "Sponsored". This is
// deliberately NOT wired up as a Popunder/interstitial — those redirect
// the *current* tab the instant the user clicks or types anywhere on the
// page, which is what was causing the Join Room form to kick people to a
// random ad page while they were just typing their invite code. A plain
// link only ever navigates when someone actually clicks this specific
// link, in a new tab, leaving the current page untouched.
export default function SponsoredLink({ className = '' }) {
  const isAdmin = useIsAdmin();
  if (!URL || isAdmin !== false) return null;

  return (
    <a
      href={URL}
      target="_blank"
      rel="noopener noreferrer nofollow sponsored"
      className={`inline-flex items-center gap-1.5 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors ${className}`}
    >
      <span className="uppercase tracking-widest">Sponsored</span>
    </a>
  );
}
