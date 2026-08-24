// frontend/src/context/AdminContext.jsx
//
// Your admin login issues an HttpOnly `admin_token` cookie (see README §7),
// which means client-side JS can never read it directly — HttpOnly exists
// specifically to prevent that. So this context doesn't try to decode a
// token; it just asks the backend "am I an admin right now?" via a
// credentialed fetch, and the backend answers by checking the same cookie
// adminMiddleware already checks on every /api/admin/* route.
//
// ChatRoom.jsx only needs a boolean, so the primary export is the
// `useIsAdmin()` hook — that's the exact name it imports:
//   import { useIsAdmin } from '../context/AdminContext';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const AdminContext = createContext({
  isAdmin: false,
  isLoading: true,
  refreshAdminStatus: async () => {},
});

export function AdminProvider({ children }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refreshAdminStatus = useCallback(async () => {
    try {
      // Adjust this path if your admin verification route is named
      // differently — it just needs to be something that reads the
      // admin_token cookie server-side and 401s if it's missing/invalid,
      // mirroring what adminMiddleware already does for other admin routes.
      const res = await fetch('/api/admin/me', { credentials: 'include' });
      setIsAdmin(res.ok);
    } catch {
      setIsAdmin(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAdminStatus();
  }, [refreshAdminStatus]);

  return (
    <AdminContext.Provider value={{ isAdmin, isLoading, refreshAdminStatus }}>
      {children}
    </AdminContext.Provider>
  );
}

// What ChatRoom.jsx actually imports.
export function useIsAdmin() {
  return useContext(AdminContext).isAdmin;
}

// Extra hook for anywhere that also needs loading state or a manual
// refresh (e.g. right after a successful /api/admin/login call).
export function useAdminStatus() {
  return useContext(AdminContext);
}

export default AdminContext;
