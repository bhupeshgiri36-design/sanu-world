import React, { createContext, useContext, useEffect, useState } from 'react';
import { adminFetch } from '../config/api';

// undefined = "still checking", true/false = resolved. Ad components
// treat undefined the same as false (don't show an ad, then flash it in
// a second later) — see useIsAdmin below.
const AdminContext = createContext(undefined);

export function AdminProvider({ children }) {
  const [isAdmin, setIsAdmin] = useState(undefined);

  useEffect(() => {
    let cancelled = false;
    adminFetch('/api/admin/me')
      .then((res) => { if (!cancelled) setIsAdmin(res.ok); })
      .catch(() => { if (!cancelled) setIsAdmin(false); });
    return () => { cancelled = true; };
  }, []);

  return <AdminContext.Provider value={isAdmin}>{children}</AdminContext.Provider>;
}

export const useIsAdmin = () => useContext(AdminContext);
