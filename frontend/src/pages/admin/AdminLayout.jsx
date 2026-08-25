import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import AdminSidebar from '../../components/admin/AdminSidebar';
import { API_ORIGIN } from '../../lib/config';

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  // Mobile-only drawer state for AdminSidebar. Desktop ignores this (the
  // sidebar is always visible at md+) — see AdminSidebar.jsx.
  const [showSidebar, setShowSidebar] = useState(false);

  // Close the drawer automatically on navigation so tapping a nav link
  // (or the back button) doesn't leave it open over the next page.
  useEffect(() => {
    setShowSidebar(false);
  }, [location.pathname]);

  useEffect(() => {
    // Quick verify session
    const checkAuth = async () => {
      try {
        const res = await fetch(`${API_ORIGIN}/api/admin/stats`, { credentials: 'include' });
        if (res.status === 401 || res.status === 403) {
          navigate('/admin-login');
        } else {
          setChecking(false);
        }
      } catch (err) {
        navigate('/admin-login');
      }
    };
    checkAuth();
  }, [navigate]);

  if (checking) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      <AdminSidebar isOpen={showSidebar} onClose={() => setShowSidebar(false)} />
      <main className="flex-1 overflow-y-auto relative min-w-0">
        {/* Mobile-only top bar — the sidebar is off-screen below md (see
            AdminSidebar's `hidden md:flex` equivalent), so without this
            there was no way to open it, and therefore no way to reach
            "Rooms" (and Create Room) from a phone at all. */}
        <div className="md:hidden sticky top-0 z-20 flex items-center gap-3 px-4 py-4 bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-800">
          <button
            onClick={() => setShowSidebar(true)}
            className="p-2 -ml-2 rounded-lg hover:bg-zinc-800 text-zinc-300 transition-colors"
          >
            <Menu size={22} />
          </button>
          <h2 className="text-sm font-extrabold text-white tracking-widest uppercase">Sanu Admin</h2>
        </div>

        {/* Background Glow */}
        <div className="fixed top-0 right-0 w-[600px] h-[600px] bg-pink-600/5 blur-[150px] rounded-full pointer-events-none" />
        <div className="p-4 md:p-8 relative z-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
