import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

import adminRoutes from './routes/adminRoutes.js';
import roomRoutes from './routes/roomRoutes.js';
import musicRoutes from './routes/musicRoutes.js'; 
import { setupSocketHandlers } from './socket/chatSocket.js';
import { roomService } from './services/roomService.js';
import adRoutes from './routes/adRoutes.js';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3001;

  // ✅ Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(cors());

  // ✅ HTTP Server with Socket.IO
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });

  // ✅ Inject io into request object for controllers to use
  app.use((req, res, next) => {
    req.io = io;
    next();
  });

  // ✅ Setup Socket.IO handlers
  setupSocketHandlers(io);

  // ✅ API Routes
  app.use('/api/admin', adminRoutes);
  app.use('/api/rooms', roomRoutes);
  app.use('/api/music', musicRoutes);
  app.use('/api/ads', adRoutes);

  // ✅ FIXED: Serve built frontend static files from frontend/dist
  // This works in both development (if you've run 'npm run build' in frontend)
  // and production (where the build happens before deployment)
  const distPath = path.resolve(__dirname, '../frontend/dist');
  app.use(express.static(distPath));

  // ✅ SPA Fallback: Send index.html for all unmatched routes
  // This allows React Router to handle client-side routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  // ✅ Error handling middleware
  app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  // ✅ Room Cleanup Interval
  // Removes empty rooms that have been empty for more than 10 minutes
  setInterval(async () => {
    try {
      const now = Date.now();
      const rooms = await roomService.getRooms();
      for (const room of rooms) {
        // Don't delete the DEMO12 sandbox room
        if (room.code === 'DEMO12') continue;
        
        // If room is empty and has been for 10+ minutes, delete it
        if (room.members && room.members.size === 0 && room.emptySince) {
          if (now - room.emptySince > 10 * 60 * 1000) {
            await roomService.deleteRoom(room.code);
            console.log(`✅ Cleaned up empty room: ${room.code}`);
          }
        }
      }
    } catch (err) {
      console.error('Error in room cleanup:', err);
    }
  }, 60 * 1000); // Run every 60 seconds

  // ✅ Start server
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`✅ Frontend served from: frontend/dist`);
    console.log(`✅ Socket.IO connected`);
    console.log(`✅ API routes: /api/admin, /api/rooms, /api/music`);
  });

  // ✅ Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    httpServer.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  });
}

// ✅ Start the server
startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
