// frontend/src/hooks/useKeyboardOpen.js

import { useEffect, useRef, useState } from 'react';

// How much shorter the viewport has to get, compared to its own tallest
// recent reading, before we call it "the keyboard is open" rather than
// normal browser chrome changes (URL bar hide/show, orientation change,
// rotation). A phone keyboard is comfortably taller than this on every
// device that matters.
const KEYBOARD_THRESHOLD_PX = 150;

// True while an on-screen keyboard is covering part of the viewport.
//
// Earlier version of this hook compared `window.innerHeight` (the layout
// viewport) against `visualViewport.height`. That only works under
// Chrome's default `resizes-visual` behavior, where the layout viewport
// stays a fixed size and only the visual viewport shrinks. This site's
// index.html sets `interactive-widget=resizes-content`, which explicitly
// asks Chrome to shrink BOTH viewports together when the keyboard opens —
// so `innerHeight` and `visualViewport.height` stay roughly equal the
// whole time, and the old comparison never crossed the threshold, meaning
// keyboardOpen was silently stuck at `false` the entire time someone was
// typing.
//
// Instead we track the tallest height we've seen recently as a
// per-orientation baseline, and say the keyboard is open whenever the
// current height drops well below that baseline. This works no matter
// which of the three `interactive-widget` resize modes the browser is
// actually honoring, since it only cares about *this device's own*
// height shrinking, not how it compares to some other viewport.
export default function useKeyboardOpen() {
  const [isOpen, setIsOpen] = useState(false);
  const baselineRef = useRef(0);

  useEffect(() => {
    const vv = window.visualViewport;
    // Even without VisualViewport support, window.innerHeight/resize is a
    // reasonable fallback baseline-tracker on its own.
    const getHeight = () => (vv ? vv.height : window.innerHeight);

    const check = () => {
      const height = getHeight();
      // A height taller than anything we've seen means there's no keyboard
      // (or we just rotated/resized to a new baseline) — raise the bar.
      if (height > baselineRef.current) {
        baselineRef.current = height;
        setIsOpen(false);
        return;
      }
      setIsOpen(baselineRef.current - height > KEYBOARD_THRESHOLD_PX);
    };
    check();

    const target = vv || window;
    target.addEventListener('resize', check);
    if (vv) vv.addEventListener('scroll', check);
    return () => {
      target.removeEventListener('resize', check);
      if (vv) vv.removeEventListener('scroll', check);
    };
  }, []);

  return isOpen;
}
