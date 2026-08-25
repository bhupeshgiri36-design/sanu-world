import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, DoorOpen, Users, AlertTriangle, ShieldBan, Megaphone, DollarSign, Settings, LogOut, X } from 'lucide-react';
import { API_ORIGIN } from '../../lib/config';

// `isOpen`/`onClose` only matter on mobile (the slide-in drawer below
// `md`). On desktop the sidebar is always visible and these are unused —
// AdminLayout still passes them so the same component works in both
// contexts without a second copy of the nav list to keep in sync.
export default function AdminSidebar({ isOpen = false, onClose = () => {} }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await fetch(`${API_ORIGIN}/api/admin/logout`, { method: 'POST', credentials: 'include' });
    navigate('/admin-login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'Rooms', path: '/admin/rooms', icon: DoorOpen },
    { name: 'Users', path: '/admin/users', icon: Users },
    { name: 'Reports', path: '/admin/reports', icon: AlertTriangle },
    { name: 'Blocked', path: '/admin/blocked', icon: ShieldBan },
    { name: 'Ads', path: '/admin/ads', icon: Megaphone },
    { name: 'Revenue', path: '/admin/revenue', icon: DollarSign },
    { name: 'Settings', path: '/admin/settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile-only scrim behind the drawer — tapping it closes the menu,
          same pattern as ChatRoom's member sidebar. */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          w-64 bg-zinc-900/95 md:bg-zinc-900/50 border-r border-zinc-800 backdrop-blur-xl
          h-screen flex flex-col
          fixed md:sticky top-0 left-0 z-40 md:z-auto
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
        `}
      >
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-white tracking-widest uppercase">Sanu Admin</h2>
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              end={item.path === '/admin'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
                  isActive 
                    ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20' 
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                }`
              }
            >
              <item.icon size={18} />
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-zinc-800">
          <button 
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-4 py-3 rounded-xl font-medium text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
