import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
// NOTE: `vite` is NOT imported at the top level anymore. It's a
// devDependency, so it isn't installed when NODE_ENV=production (Render
// skips devDependencies on `npm install` in that case). A static top-level
// import runs immediately regardless of which branch uses it — that's what
// crashed the server on boot ("Cannot find package 'vite'"). It's now
// imported dynamically below, only inside the branch that needs it.
import adminRoutes from './routes/adminRoutes.js';
import roomRoutes from './routes/roomRoutes.js';
import musicRoutes from './routes/musicRoutes.js'; 
import mediaRoutes from './routes/mediaRoutes.js';
import { setupSocketHandlers } from './socket/chatSocket.js';
import { roomService } from './services/roomService.js';
import { createRateLimiter, getClientIp } from './utils/rateLimiter.js';
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;
  app.use(express.json());
  app.use(cookieParser());
  // Sanu's admin identity is verified from the admin_token cookie inside
  // the Socket.IO handshake (see socket/adminAuth.js). Browsers only
  // attach cookies to a cross-origin request when the CORS response names
  // the exact origin AND allows credentials — `origin: '*'` silently drops
  // the cookie, which is why this must list real origins, not a wildcard.
  const allowedOrigins = [
    'https://sanu-world.onrender.com',
    'http://localhost:5173',
    'http://localhost:3000'
  ];
  const corsOptions = {
    origin: allowedOrigins,
    credentials: true
  };
  app.use(cors(corsOptions));
  // Uploaded chat images/videos live on disk and are served directly —
  // chat messages just carry the URL, not the file bytes.
  app.use('/uploads', express.static(path.resolve(__dirname, 'uploads')));
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: corsOptions
  });

  // A person opening/closing lots of connections (or a script hammering
  // the socket endpoint) shouldn't be able to do it unthrottled. This
  // blocks the connection at the handshake, before any room/join logic
  // even runs — 30 new connections / minute per IP is generous for a
  // browser tab reconnecting on a bad network, tight for a flood.
  const checkConnectionRate = createRateLimiter({ windowMs: 60 * 1000, max: 30 });
  io.use((socket, next) => {
    const ip = getClientIp(socket.handshake);
    const { allowed } = checkConnectionRate(ip);
    if (!allowed) {
      return next(new Error('Too many connections, please slow down.'));
    }
    next();
  });

  // Inject io into request object for controllers to use
  app.use((req, res, next) => {
    req.io = io;
    next();
  });
  // Setup Socket.IO
  setupSocketHandlers(io);

  // Simple health check — useful for confirming the service is actually
  // up (and not just that Render's own placeholder page is what's
  // answering) when debugging deploys.
  app.get('/healthz', (req, res) => res.json({ ok: true }));

  // API Routes
  app.use('/api/admin', adminRoutes);
  app.use('/api/rooms', roomRoutes);
  app.use('/api/music', musicRoutes);
  app.use('/api/media', mediaRoutes);

  // Anything under /api/* that didn't match a route above is a genuine
  // 404 — return JSON, not Express's default HTML "Cannot GET ..." page.
  // The frontend's adminFetch/fetch calls always expect JSON back; an
  // HTML response there is exactly what produced "Unexpected token '<'"
  // errors in the browser console.
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Vite Middleware for Development
  if (process.env.NODE_ENV !== 'production') {
    // Dynamic import — only reached (and only resolved) when NOT in
    // production, i.e. only when vite is actually installed.
    const { createServer: createViteServer } = await import('vite');
    // Note: In AI Studio, we need to point vite middleware to the frontend directory
    const frontendPath = path.resolve(__dirname, '../frontend');
    const vite = await createViteServer({
      root: frontendPath,
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  // Global JSON error handler — MUST be registered after all routes.
  // Any error passed to next(err) (including everything wrapped in
  // asyncHandler) lands here instead of Express's default HTML error
  // page. This is the safety net: no matter what throws inside a route,
  // the frontend always gets back parseable JSON.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error('Unhandled request error:', err);
    if (res.headersSent) return next(err);
    const status = err.status || err.statusCode || 500;
    res.status(status).json({
      error: process.env.NODE_ENV === 'production'
        ? 'Something went wrong. Please try again.'
        : (err.message || 'Internal server error')
    });
  });

  // Room Cleanup Interval — wrapped so a transient error here just gets
  // logged and retried a minute later, instead of an unhandled promise
  // rejection potentially taking the whole process down.
  setInterval(async () => {
    try {
      const now = Date.now();
      const rooms = await roomService.getRooms();
      for (const room of rooms) {
        if (room.code === 'DEMO12') continue;
        if (room.members && room.members.size === 0 && room.emptySince) {
          if (now - room.emptySince > 10 * 60 * 1000) {
            await roomService.deleteRoom(room.code);
            console.log(`Room ${room.code} cleaned up.`);
          }
        }
      }
    } catch (err) {
      console.error('Room cleanup interval failed:', err);
    }
  }, 60 * 1000);

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Catch anything that still slips through as a raw unhandled rejection
// (e.g. inside socket handlers, which asyncHandler doesn't cover) so it's
// logged instead of silently killing the process on some Node versions.
process.on('unhandledRejection', (err) => {
  console.error('Unhandled promise rejection:', err);
});

startServer().catch((err) => {
  console.error('Fatal error during server startup:', err);
  process.exit(1);
});
