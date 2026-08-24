import React, { useEffect, useRef } from 'react';

export default function AdSlot({ snippetHtml, width, height, className = '', label = 'ADVERTISEMENT' }) {
  const iframeRef = useRef(null);

  useEffect(() => {
    if (!snippetHtml || !iframeRef.current) return;
    const doc = iframeRef.current.contentDocument;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><style>
      html,body{margin:0;padding:0;background:transparent;overflow:hidden;}
    </style></head><body>${snippetHtml}</body></html>`);
    doc.close();
  }, [snippetHtml]);

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

  return (
    <iframe
      ref={iframeRef}
      title="advertisement"
      className={className}
      style={{ width, height, border: 'none', display: 'block' }}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
    />
  );
}
