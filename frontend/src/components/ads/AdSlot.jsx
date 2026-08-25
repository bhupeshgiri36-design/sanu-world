import React, { useEffect, useRef, useState } from 'react';

// nativeWidth/nativeHeight describe the ad creative's real, fixed pixel
// size (e.g. Adsterra's 728x90 banner or 160x600 skyscraper). These ad
// formats don't reflow themselves — on a narrow phone screen the raw
// iframe either overflows the layout or gets silently clipped on the
// side. Instead we measure the available width every time it changes
// and scale the whole creative down with a CSS transform to fit,
// keeping it centered and fully visible instead of cut off.
export default function AdSlot({
  snippetHtml,
  nativeWidth = 300,
  nativeHeight = 250,
  className = '',
  label = 'ADVERTISEMENT',
}) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);

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
        title="advertisement"
        style={{
          width: nativeWidth,
          height: nativeHeight,
          border: 'none',
          display: 'block',
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
        }}
        // NOTE: deliberately does NOT include "allow-popups-to-escape-sandbox"
        // or "allow-top-navigation". Those two flags are what let an ad
        // script hijack the *parent tab* (redirect the whole site the
        // moment the user clicks/types anywhere) instead of just opening
        // its own popup. "allow-popups" alone still lets a banner open a
        // normal new tab when someone actually clicks the ad creative —
        // it just can't take over navigation of this page.
        sandbox="allow-scripts allow-popups"
        srcDoc={doc}
      />
    </div>
  );
}
