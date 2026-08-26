import { useEffect, useRef } from 'react';
import { useIsAdmin } from '../../context/AdminContext';
import useKeyboardOpen from '../../hooks/useKeyboardOpen';

const SNIPPET = import.meta.env.VITE_SOCIAL_BAR_SNIPPET || '';

// Social Bar is a small persistent widget the ad network docks to a
// corner of the viewport itself (it does not need a sized container the
// way banner/native ads do), so unlike TopAd/BottomAd/SideAd/NativeAd
// this one is NOT rendered through AdSlot's sandboxed iframe — it's
// injected once as a real <script> tag, exactly the way the network's
// own embed instructions expect. It is intentionally NOT the Popunder
// script: Popunder hijacks the *next click anywhere on the page* to
// force a redirect, which is what was silently breaking the Join Room
// form (typing/clicking in the code or nickname field would trigger a
// full-page redirect). Social Bar only shows its own small widget and
// never redirects the current tab, so it's safe to mount globally.
export default function SocialBarAd() {
  const isAdmin = useIsAdmin();
  // The network docks this widget with its own fixed positioning, which
  // (like StickyMobileAd) doesn't track the on-screen keyboard and ends
  // up floating over it or leaving a gap. We can't unmount-and-remount the
  // script every time the keyboard opens/closes without burning a fresh
  // impression each time, so instead we keep the injected container in a
  // ref and just toggle its visibility.
  const keyboardOpen = useKeyboardOpen();
  const containerRef = useRef(null);

  useEffect(() => {
    if (!SNIPPET || isAdmin !== false) return;

    const container = document.createElement('div');
    container.id = 'sanu-social-bar-ad';
    // Parse out the <script src="..."> the network gives us and load it
    // as a real script element — setting innerHTML on a container does
    // not execute embedded <script> tags, only creating one via
    // document.createElement does.
    const srcMatch = SNIPPET.match(/src=["']([^"']+)["']/);
    const script = document.createElement('script');
    if (srcMatch) {
      script.src = srcMatch[1];
      script.async = true;
    } else {
      script.textContent = SNIPPET;
    }
    container.appendChild(script);
    document.body.appendChild(container);
    containerRef.current = container;

    return () => {
      document.body.removeChild(container);
      containerRef.current = null;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.display = keyboardOpen ? 'none' : '';
    }
  }, [keyboardOpen]);

  return null;
}
