import React, { useEffect, useRef, useState } from 'react';

// nativeWidth/nativeHeight describe the ad creative's real, fixed pixel
// size (e.g. Adsterra's 728x90 banner or 160x600 skyscraper). These ad
// formats don't reflow themselves — on a narrow phone screen the raw
// iframe either overflows the layout or gets silently clipped on the
// side. Instead we measure the available width every time it changes
// and scale the whole creative down with a CSS transform to fit,
// keeping it centered and fully visible instead of cut off.
//
// refreshSeconds (optional): remounts the iframe on this interval so a
// long-lived session (someone sitting in a chat room for an hour) earns
// more than one impression from a single page load. Two safety rules
// baked in, not configurable per-call, because they protect the account
// itself, not just this one ad:
//   1. Floor of 30s — faster than that reads as invalid-traffic/refresh
//      abuse to ad networks and risks the zone getting flagged.
//   2. Paused via the Page Visibility API whenever the tab isn't visible
//      — an ad "refreshing" behind a minimized browser isn't a real
//      impression to anyone, and networks watch for exactly that pattern.
// Omit the prop entirely (default) for a normal single-load ad, same as
// before this change.
const MIN_REFRESH_SECONDS = 30;

export default function AdSlot({
  snippetHtml,
  nativeWidth = 300,
  nativeHeight = 250,
  className = '',
  label = 'ADVERTISEMENT',
  refreshSeconds,
}) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const available = el.offsetWidth;
      // Never scale UP past 1 — only shrink to fit on small screens.
      setScale(available > 0 ? Math.min(1, available / nativeWidth) : 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [nativeWidth]);

  useEffect(() => {
    if (!refreshSeconds || !snippetHtml) return;
    const intervalMs = Math.max(refreshSeconds, MIN_REFRESH_SECONDS) * 1000;

    let timer = null;
    const tick = () => setRefreshKey((k) => k + 1);
    const start = () => {
      if (timer) return;
      timer = setInterval(tick, intervalMs);
    };
    const stop = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    };

    // Only run the timer while this tab is the one actually on screen.
    if (document.visibilityState === 'visible') start();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') start();
      else stop();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refreshSeconds, snippetHtml]);

  const scaledHeight = Math.round(nativeHeight * scale);

  if (!snippetHtml) {
    return (
      <div
        ref={containerRef}
        className={`bg-[#1A1A1E] border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-600 font-bold tracking-widest text-xs shadow-inner w-full ${className}`}
        style={{ height: scaledHeight || nativeHeight }}
      >
        {label}
      </div>
    );
  }

  // Seed the iframe via srcDoc instead of ref + document.open/write/close.
  // This avoids ever touching contentDocument/contentWindow.document, which
  // is what caused both the earlier "Cannot read properties of null"
  // crash and the later "Blocked a frame with origin ... cross-origin
  // frame" SecurityError. The browser renders srcDoc itself, so the
  // parent never needs (or is allowed) to reach into the sandboxed frame.
  const doc = `<!DOCTYPE html><html><head><style>
    html,body{margin:0;padding:0;background:transparent;overflow:hidden;}
  </style></head><body>${snippetHtml}</body></html>`;

  return (
    <div
      ref={containerRef}
      className={`w-full overflow-hidden flex justify-center ${className}`}
      style={{ height: scaledHeight }}
    >
      <iframe
        // key includes refreshKey so React fully remounts (not just
        // updates) the iframe on each tick — that's what forces the ad
        // script to actually re-run and fetch a new creative/impression,
        // rather than sitting inert inside the same frame.
        key={refreshKey}
        title="advertisement"
        style={{
          width: nativeWidth,
          height: nativeHeight,
          border: 'none',
          display: 'block',
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
        }}
        // 🔧 FIXED: added "allow-same-origin". A srcDoc iframe sandboxed
        // WITHOUT allow-same-origin gets an opaque/null origin. Most ad
        // network scripts (including Adsterra's invoke.js) make XHR/fetch
        // calls and read cookies to decide what creative to serve — from a
        // null origin those requests are silently rejected or treated as
        // "no fill", with the failure happening inside the sandboxed
        // iframe's own console, invisible from the parent page. That is
        // exactly why every real Adsterra key was correctly set, the
        // snippet was correctly injected, and yet no creative ever
        // rendered: the ad script itself couldn't successfully call home.
        //
        // This still deliberately excludes "allow-popups-to-escape-sandbox"
        // and "allow-top-navigation" — those two are what let an ad
        // script hijack the *parent tab's* navigation the moment someone
        // clicks or types anywhere on the page, which is the bug that
        // broke the Join Room form earlier. "allow-same-origin" only
        // grants the iframe a real (non-null) origin so its own network
        // requests work; it does not grant it any ability to navigate or
        // reach into the parent page.
        sandbox="allow-scripts allow-same-origin allow-popups"
        srcDoc={doc}
      />
    </div>
  );
}
