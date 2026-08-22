// frontend/src/App.jsx

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './components/Landing';
import JoinRoom from './components/JoinRoom';
import ChatRoom from './components/ChatRoom';
import Goodbye from './pages/Goodbye';

// Admin imports
import AdminLogin from './pages/AdminLogin';
import AdminLayout from './pages/admin/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import Rooms from './pages/admin/Rooms';
import Users from './pages/admin/Users';
import Reports from './pages/admin/Reports';
import Blocked from './pages/admin/Blocked';
import Ads from './pages/admin/Ads';
import Revenue from './pages/admin/Revenue';
import Settings from './pages/admin/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/join" element={<JoinRoom />} />
        <Route path="/room/:code" element={<ChatRoom />} />
        <Route path="/goodbye" element={<Goodbye />} />

        {/* Admin Routes */}
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
    </BrowserRouter>
  );
}