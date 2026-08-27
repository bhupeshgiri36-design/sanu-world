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
//
// This hook ALSO writes the live height to a `--app-height` CSS custom
// property on <html>, in px, every time it changes. ChatRoom sizes its
// root container from that var (falling back to `100dvh` only until the
// first reading lands) instead of from `100dvh` alone. That's not
// redundant with `interactive-widget=resizes-content` — it's a fallback
// for it. `dvh` and the resize-content behavior it depends on are only
// reliably honored on recent Chrome; plenty of real Android devices out
// there run older WebView/Chrome builds (or in-app browsers) that ignore
// the meta tag, silently fall back to `resizes-visual`, and never shrink
// the layout viewport `dvh` is computed from at all. On those, `100dvh`
// stays pinned at the pre-keyboard height while `visualViewport.height`
// (what this hook already reads) correctly reports the shrunk value —
// which is exactly what produced the floating composer with dead gaps
// above and below it: the flex column was sized to the tall, stale
// `dvh` reading, so its last child (the composer) landed wherever normal
// flow put it inside that oversized box instead of pinned to the bottom
// of what's actually visible. Driving height from `visualViewport`
// directly sidesteps the question of whether `dvh`/resize-content is
// supported at all.
export default function useKeyboardOpen() {
  const [isOpen, setIsOpen] = useState(false);
  const baselineRef = useRef(0);

  useEffect(() => {
    const vv = window.visualViewport;
    // Even without VisualViewport support, window.innerHeight/resize is a
    // reasonable fallback baseline-tracker on its own.
    const getHeight = () => (vv ? vv.height : window.innerHeight);

    const applyHeightVar = (height) => {
      document.documentElement.style.setProperty('--app-height', `${height}px`);
    };

    const check = () => {
      const height = getHeight();
      applyHeightVar(height);
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

    // Re-sample `visualViewport.height` on every animation frame for a
    // short window after any resize/scroll/focus change, instead of
    // reading it once. A single read right after the triggering event can
    // land mid-way through the keyboard's open/close animation and then
    // never get corrected (that's the "freeze at a stale height" failure
    // mode described above) — polling across frames means the var keeps
    // catching up until the animation actually finishes.
    // In-app browsers (WhatsApp, Telegram, Instagram, etc.) sometimes
    // report a too-small visualViewport height on the very first read —
    // their own chrome (top toolbar, "shared media" bar) is still
    // mid-animation-in and hasn't settled yet — and then never fire a
    // resize event once it does settle. Without this, --app-height gets
    // locked to that smaller, stale number forever: the flex column
    // renders shorter than the screen actually is, the message list gets
    // squeezed toward zero, and the composer ends up sitting right up
    // against whatever's above it with a dead gap of native background
    // below — the "lifted composer" bug. Re-checking on a short timer for
    // the first couple of seconds after mount, independent of any
    // resize/focus event, catches that late settle.
    const settleTimer = setInterval(check, 200);
    const stopSettleTimer = setTimeout(() => clearInterval(settleTimer), 2000);

    let rafId = null;
    const trackDuringAnimation = () => {
      if (!vv) return;
      const start = Date.now();
      const step = () => {
        applyHeightVar(vv.height);
        if (Date.now() - start < 400) {
          rafId = requestAnimationFrame(step);
        } else {
          rafId = null;
        }
      };
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(step);
    };

    const onResize = () => {
      check();
      trackDuringAnimation();
    };

    const target = vv || window;
    target.addEventListener('resize', onResize);
    if (vv) {
      vv.addEventListener('scroll', onResize);
      // If VisualViewport exists but this WebView still doesn't fire its
      // resize event reliably (seen in Telegram's in-app browser), a
      // plain window resize is a second chance to catch the same change.
      window.addEventListener('resize', onResize);
    }

    // Belt-and-suspenders: some in-app browsers fire NEITHER of the above
    // when the keyboard opens/closes — the height only updates a beat
    // later with no event at all to hook. Poll briefly right after any
    // text input gains/loses focus so we still catch it, and also start
    // the rAF tracker immediately on focus/blur so the height var stays
    // glued to the real viewport for the full open/close animation
    // instead of only updating once it settles.
    let pollTimer = null;
    const pollFor = (ms) => {
      const stopAt = Date.now() + ms;
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(() => {
        check();
        if (Date.now() > stopAt) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      }, 120);
    };
    const onFocusChange = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        pollFor(1500);
        trackDuringAnimation();
      }
    };
    document.addEventListener('focusin', onFocusChange);
    document.addEventListener('focusout', onFocusChange);

    return () => {
      clearInterval(settleTimer);
      clearTimeout(stopSettleTimer);
      target.removeEventListener('resize', onResize);
      if (vv) {
        vv.removeEventListener('scroll', onResize);
        window.removeEventListener('resize', onResize);
      }
      document.removeEventListener('focusin', onFocusChange);
      document.removeEventListener('focusout', onFocusChange);
      if (pollTimer) clearInterval(pollTimer);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return isOpen;
}
