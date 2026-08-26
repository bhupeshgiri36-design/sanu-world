// frontend/src/hooks/useKeyboardOpen.js

import { useEffect, useState } from 'react';

// How much smaller the visual viewport has to be than the window's full
// layout height before we call it "the keyboard is open" rather than just
// normal browser chrome (URL bar hide/show, orientation change, etc). A
// phone keyboard is comfortably taller than this on every device that
// matters, so this threshold doesn't false-positive on Chrome's own UI.
const KEYBOARD_THRESHOLD_PX = 150;

// True while an on-screen keyboard is covering part of the viewport.
// Used to hide sticky/fixed ad widgets (SocialBarAd, StickyMobileAd) while
// someone is actively typing, since those ads are positioned by the ad
// network's own script relative to the *layout* viewport, which doesn't
// move with the keyboard the way `visualViewport` does — left on screen
// they either overlap the keyboard or leave a dead gap above it.
export default function useKeyboardOpen() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return; // no API support: assume no keyboard, never hide ads

    const check = () => {
      const gap = window.innerHeight - vv.height;
      setIsOpen(gap > KEYBOARD_THRESHOLD_PX);
    };
    check();

    vv.addEventListener('resize', check);
    vv.addEventListener('scroll', check);
    return () => {
      vv.removeEventListener('resize', check);
      vv.removeEventListener('scroll', check);
    };
  }, []);

  return isOpen;
}
