import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Fix for in-app browsers (Instagram, Facebook, etc.) where 100dvh doesn't
// track the real visible viewport, leaving dead black space at the bottom
// of full-height screens like ChatRoom. We store the real viewport height
// in a CSS variable and keep it updated on resize/orientation change.
//
// UPDATED: window.innerHeight was only being captured once, on the very
// first paint, before content like the music player had rendered in and
// changed the page's actual height. Mobile browsers often adjust their
// own address-bar height in response to that (collapsing/expanding the
// chrome), which window.innerHeight doesn't reliably re-report through a
// plain 'resize' listener — the CSS var went stale the moment content
// height changed, which is what made the message list + input look
// "lifted" whenever the music player was visible (extra header height)
// and "normal" again once it was hidden. visualViewport.height tracks the
// actual visible area live, including keyboard and address-bar changes,
// so we prefer it when the browser supports it (all modern mobile
// browsers do) and keep the old window-based path as a fallback only for
// browsers that don't.
function setAppHeight() {
  const height = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty('--app-height', `${height}px`);
}
setAppHeight();

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', setAppHeight);
} else {
  window.addEventListener('resize', setAppHeight);
}
window.addEventListener('orientationchange', setAppHeight);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
