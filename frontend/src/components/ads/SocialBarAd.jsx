import { useEffect, useRef } from 'react';
import { useIsAdminConfirmed } from '../../context/AdminContext';
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
  // Injection gate uses the CONFIRMED admin value, not the fast-timeout
  // one from useIsAdmin(). AdminContext force-sets isAdmin=false if the
  // /admin/session check hasn't resolved within 2.5s (so banner ads
  // aren't blocked for 20-50s during a Render cold start). That's fine
  // for a banner — worst case it shows a few seconds late for a real
  // visitor. It's not fine here: this ad injects a live third-party
  // <script>, and that network's own code can render a popup/overlay
  // directly on document.body, outside the container our cleanup
  // removes. If the 2.5s timeout fires for an admin whose session check
  // is just slow, the popup can appear and then persist even after the
  // real check later confirms `true` — which is exactly the "ad still
  // shows for admin" bug. Waiting for the confirmed value means this
  // never injects until we genuinely know the visitor isn't an admin.
  const isAdminConfirmed = useIsAdminConfirmed();
  // The network docks this widget with its own fixed positioning, which
  // (like StickyMobileAd) doesn't track the on-screen keyboard and ends
  // up floating over it or leaving a gap. We can't unmount-and-remount the
  // script every time the keyboard opens/closes without burning a fresh
  // impression each time, so instead we keep the injected container in a
  // ref and just toggle its visibility.
  const keyboardOpen = useKeyboardOpen();
  const containerRef = useRef(null);

  useEffect(() => {
    if (!SNIPPET || isAdminConfirmed !== false) return;

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
  }, [isAdminConfirmed]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.display = keyboardOpen ? 'none' : '';
    }
  }, [keyboardOpen]);

  return null;
}
