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
//
// UPDATED AGAIN: on Chrome for Android specifically, visualViewport fires
// a *resize* event not just once when the keyboard opens, but repeatedly
// while typing — the autofill suggestion strip (the row of key/card/pin
// icons above the keyboard) grows and shrinks by a few pixels as its
// content changes per keystroke, and each of those tiny fluctuations was
// being treated as a real height change. That forced --app-height to
// update, which forced ChatRoom's whole flex column (header, message
// list, input bar) to recompute layout on every single keystroke — that
// full-layout jitter is what read as "the message box keeps lifting up
// while typing". Two fixes: (1) collapse bursts of resize events into one
// with requestAnimationFrame, since several can fire back-to-back during
// a single UI change, and (2) ignore deltas under IGNORE_THRESHOLD_PX —
// a real keyboard open/close moves the viewport by a large amount
// (100px+), so small noise from the autofill strip never reaches it.
const IGNORE_THRESHOLD_PX = 40;
let lastHeight = null;
let rafId = null;

function applyAppHeight() {
  rafId = null;
  const height = window.visualViewport?.height ?? window.innerHeight;
  if (lastHeight !== null && Math.abs(height - lastHeight) < IGNORE_THRESHOLD_PX) {
    return;
  }
  lastHeight = height;
  document.documentElement.style.setProperty('--app-height', `${height}px`);
}

function setAppHeight() {
  if (rafId !== null) return;
  rafId = requestAnimationFrame(applyAppHeight);
}

// First call always applies immediately (no previous height to diff
// against), so the initial paint is correct even before any resize fires.
(function setInitialAppHeight() {
  const height = window.visualViewport?.height ?? window.innerHeight;
  lastHeight = height;
  document.documentElement.style.setProperty('--app-height', `${height}px`);
})();

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
