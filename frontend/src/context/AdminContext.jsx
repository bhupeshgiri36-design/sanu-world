import React, { createContext, useContext, useEffect, useState } from 'react';
import { adminFetch } from '../lib/api';

// undefined = "still checking", true/false = resolved. Ad components
// treat undefined the same as false (don't show an ad, then flash it in
// a second later) — see useIsAdmin below.
const AdminContext = createContext(undefined);

// Second, separate context for the UNFORCED resolution — see
// isAdminConfirmed below for why this needs to exist independently of
// AdminContext.
const AdminConfirmedContext = createContext(undefined);

// If the backend is asleep (Render's free tier spins the service down
// after 15 minutes idle and takes 20-50s+ to wake back up on the next
// request), this check can sit unresolved for a long time — and because
// every ad component treats `undefined` the same as "hide", that alone
// was enough to keep every single ad on the site invisible for the
// first 20-50 seconds of a visit, which is what read as "ads loading
// very slowly". It's not the ad network being slow, it's this session
// check gating them shut behind a cold backend. We still want it to be
// authoritative for real admins, so instead of skipping it, we just
// stop letting it block ads past a short timeout: if it hasn't resolved
// in 2.5s we assume "not admin" and let ads render, then correct that
// (in either direction) once the real response eventually comes back.
const ADMIN_CHECK_TIMEOUT_MS = 2500;

export function AdminProvider({ children }) {
  const [isAdmin, setIsAdmin] = useState(undefined);

  // Real, UNFORCED resolution of the admin check — stays `undefined`
  // until /admin/session actually settles, and is never flipped to
  // `false` early by the timeout above.
  //
  // Banner ads (Top/Bottom/Mid/Native/Side/Skyscraper/etc.) can tolerate
  // a false "not admin" reading for a few seconds during a cold start —
  // worst case, a real visitor's ad shows up a little late. Script-
  // injecting ads (SocialBarAd, PopunderAd) can't: the moment they
  // inject a third-party <script>, that network's own code can render a
  // popup/overlay directly on document.body, outside the container our
  // own cleanup removes. If the 2.5s timeout forces isAdmin=false for an
  // admin whose session check is just slow (cold backend), that popup
  // can appear and persist even after the real check later comes back
  // `true` — which is exactly the "ad still shows for admin" bug this
  // separate, unforced value exists to prevent. Script-injecting ads
  // should read `isAdminConfirmed` (via useIsAdminConfirmed) instead of
  // `isAdmin`, and simply wait the extra few seconds for certainty.
  const [isAdminConfirmed, setIsAdminConfirmed] = useState(undefined);

  useEffect(() => {
    let cancelled = false;

    const timeout = setTimeout(() => {
      if (!cancelled) setIsAdmin((prev) => (prev === undefined ? false : prev));
    }, ADMIN_CHECK_TIMEOUT_MS);

    adminFetch('/admin/session')
      .then(() => {
        if (!cancelled) {
          setIsAdmin(true);
          setIsAdminConfirmed(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsAdmin(false);
          setIsAdminConfirmed(false);
        }
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  return (
    <AdminContext.Provider value={isAdmin}>
      <AdminConfirmedContext.Provider value={isAdminConfirmed}>
        {children}
      </AdminConfirmedContext.Provider>
    </AdminContext.Provider>
  );
}

// Fast-resolving value (can be forced to `false` after 2.5s even if the
// real check is still pending). Use this for ordinary banner ads.
export const useIsAdmin = () => useContext(AdminContext);

// Slow-but-certain value (only ever `true`/`false` once /admin/session
// has actually responded; never forced). Use this for anything that
// injects a third-party script or otherwise can't be cleanly un-shown
// once triggered — SocialBarAd, PopunderAd.
export const useIsAdminConfirmed = () => useContext(AdminConfirmedContext);
