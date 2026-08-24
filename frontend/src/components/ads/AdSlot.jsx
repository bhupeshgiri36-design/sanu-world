import React from 'react';

export default function AdSlot({ snippetHtml, width, height, className = '', label = 'ADVERTISEMENT' }) {
  if (!snippetHtml) {
    return (
      <div
        className={`bg-[#1A1A1E] border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-600 font-bold tracking-widest text-xs shadow-inner ${className}`}
        style={{ width, height }}
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
    <iframe
      title="advertisement"
      className={className}
      style={{ width, height, border: 'none', display: 'block' }}
      // Deliberately no "allow-same-origin" here — combining it with
      // allow-scripts would let third-party ad JS escape the sandbox
      // and access the parent page. Keep the sandbox as-is.
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
      srcDoc={doc}
    />
  );
}
