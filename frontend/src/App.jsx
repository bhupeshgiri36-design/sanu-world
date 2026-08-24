import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AdminProvider } from './context/AdminContext';
import { startKeepAlive } from './lib/keepAlive';

import Landing from './components/Landing';
const JoinRoom = lazy(() => import('./components/JoinRoom'));
const ChatRoom = lazy(() => import('./components/ChatRoom'));
const Goodbye = lazy(() => import('./pages/Goodbye'));

const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const Rooms = lazy(() => import('./pages/admin/Rooms'));
const Users = lazy(() => import('./pages/admin/Users'));
const Reports = lazy(() => import('./pages/admin/Reports'));
const Blocked = lazy(() => import('./pages/admin/Blocked'));
const Ads = lazy(() => import('./pages/admin/Ads'));
const Revenue = lazy(() => import('./pages/admin/Revenue'));
const Settings = lazy(() => import('./pages/admin/Settings'));

function RouteLoading() {
  return (
    <div className="min-h-screen bg-[#0D0D0F] flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#ff8bb3]" />
    </div>
  );
}

export default function App() {
  useEffect(() => {
    const stop = startKeepAlive();
    return stop;
  }, []);

  return (
    <AdminProvider>
      <BrowserRouter>
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/join" element={<JoinRoom />} />
            <Route path="/room/:code" element={<ChatRoom />} />
            <Route path="/goodbye" element={<Goodbye />} />
            <Route path="/admin-login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="rooms" element={<Rooms />} />
              <Route path="users" element={<Users />} />
              <Route path="reports" element={<Reports />} />
              <Route path="blocked" element={<Blocked />} />
              <Route path="ads" element={<Ads />} />
              <Route path="revenue" element={<Revenue />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AdminProvider>
  );
}
