import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import AdminSidebar from '../../components/admin/AdminSidebar';

export default function AdminLayout() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Quick verify session
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/admin/stats');
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
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto relative">
        {/* Background Glow */}
        <div className="fixed top-0 right-0 w-[600px] h-[600px] bg-pink-600/5 blur-[150px] rounded-full pointer-events-none" />
        <div className="p-8 relative z-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
