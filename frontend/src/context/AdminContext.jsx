import React, { createContext, useContext, useEffect, useState } from 'react';
import { adminFetch } from '../lib/api';

// undefined = "still checking", true/false = resolved. Ad components
// treat undefined the same as false (don't show an ad, then flash it in
// a second later) — see useIsAdmin below.
const AdminContext = createContext(undefined);

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

  useEffect(() => {
    let cancelled = false;

    const timeout = setTimeout(() => {
      if (!cancelled) setIsAdmin((prev) => (prev === undefined ? false : prev));
    }, ADMIN_CHECK_TIMEOUT_MS);

    adminFetch('/admin/session')
      .then(() => { if (!cancelled) setIsAdmin(true); })
      .catch(() => { if (!cancelled) setIsAdmin(false); })
      .finally(() => clearTimeout(timeout));

    return () => { cancelled = true; clearTimeout(timeout); };
  }, []);

  return <AdminContext.Provider value={isAdmin}>{children}</AdminContext.Provider>;
}

export const useIsAdmin = () => useContext(AdminContext);
