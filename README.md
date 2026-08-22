# Sanu World

Welcome to the Sanu World production repository!

## 1. Project Structure

This project is separated into a clean client-server architecture:
- `frontend/`: The React + Vite SPA.
- `backend/`: The Node.js + Express + Socket.IO server.
- `database/`: Supabase PostgreSQL schema and migration files.

## 2. How to install frontend
```bash
cd frontend
npm install
```

## 3. How to install backend
```bash
cd backend
npm install
```

## 4. Environment Variables
Copy `.env.example` to `.env` in both the `frontend/` and `backend/` folders and populate the values.
**Backend (.env):**
- `PORT=3000`
- `JWT_SECRET=your_super_secret_jwt_key`
- `SUPABASE_URL=https://your-project-id.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY=your_service_role_key`
- `SHRINKEARN_API_TOKEN=your_shrinkearn_token`

*Never expose backend secrets in the frontend.*

## 5. How to run frontend
```bash
cd frontend
npm run dev
```
(Note: when running the full stack, the backend can serve the frontend via Vite middleware)

## 6. How to run backend
```bash
cd backend
npm run dev
```

## 7. How Admin Authentication works
The admin login (`/api/admin/login`) validates credentials and issues an `HttpOnly` JWT cookie (`admin_token`).
All `GET/POST /api/admin/*` endpoints use `adminMiddleware` to verify the JWT and enforce `role === "admin"`.
Normal users or unauthenticated requests receive a `403 Forbidden` or `401 Unauthorized`.

## 8. How rooms work
Admins create rooms from the dashboard. The backend creates a unique 6-character room code (e.g., `AB123`) in the Supabase `rooms` table.
Visitors access the room via `/room/AB123`.

## 9. How Socket.IO works
The frontend uses `socket.io-client` to connect to the backend's Socket.IO server on `join-room`.
The backend validates room capacity and password in `backend/socket/chatSocket.js`. Real-time chat messages and music states are broadcasted to the specific room channel.

## 10. How Supabase will be connected
The project uses `@supabase/supabase-js` inside `backend/config/supabase.js`.
Database interactions are abstracted in `backend/services/roomService.js`. The SQL schema is located in `database/schema.sql`.

## 11. Where advertising integration will be added
Ads are handled safely without frontend token exposure.
Frontend placeholders are in `frontend/src/components/ads/`.
Backend service integration will be built in `backend/services/adService.js` to log impressions and clicks to Supabase `ad_events`.

## 12. Where ShrinkEarn integration will be added
The ShrinkEarn API will be called securely from the backend to prevent API key leakage.
Code goes into `backend/services/shrinkEarnService.js`.
