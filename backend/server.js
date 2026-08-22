import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

import adminRoutes from './routes/adminRoutes.js';
import roomRoutes from './routes/roomRoutes.js';
import musicRoutes from './routes/musicRoutes.js'; 
import { setupSocketHandlers } from './socket/chatSocket.js';
import { roomService } from './services/roomService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());
  app.use(cors());

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });

  // Inject io into request object for controllers to use
  app.use((req, res, next) => {
    req.io = io;
    next();
  });

  // Setup Socket.IO
  setupSocketHandlers(io);

  // API Routes
  app.use('/api/admin', adminRoutes);
  app.use('/api/rooms', roomRoutes);
  app.use('/api/music', musicRoutes);

  // Vite Middleware for Development
  if (process.env.NODE_ENV !== 'production') {
    // Note: In AI Studio, we need to point vite middleware to the frontend directory
    const frontendPath = path.resolve(__dirname, '../frontend');
    const vite = await createViteServer({
      root: frontendPath,
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.resolve(__dirname, '../frontend/dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Room Cleanup Interval
  setInterval(async () => {
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
  }, 60 * 1000);

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch(console.error);
