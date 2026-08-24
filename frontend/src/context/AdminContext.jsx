import React, { createContext, useContext, useEffect, useState } from 'react';
import { adminFetch } from '../lib/api';

// undefined = "still checking", true/false = resolved. Ad components
// treat undefined the same as false (don't show an ad, then flash it in
// a second later) — see useIsAdmin below.
const AdminContext = createContext(undefined);

export function AdminProvider({ children }) {
  const [isAdmin, setIsAdmin] = useState(undefined);

  useEffect(() => {
    let cancelled = false;
    adminFetch('/admin/me')
      .then(() => { if (!cancelled) setIsAdmin(true); })
      .catch(() => { if (!cancelled) setIsAdmin(false); });
    return () => { cancelled = true; };
  }, []);

  return <AdminContext.Provider value={isAdmin}>{children}</AdminContext.Provider>;
}

export const useIsAdmin = () => useContext(AdminContext);
