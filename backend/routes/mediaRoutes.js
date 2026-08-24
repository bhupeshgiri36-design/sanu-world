// backend/routes/mediaRoutes.js
//
// Chat images/videos used to be sent as base64 straight through the
// socket, capped at ~2MB so the payload didn't blow up. That made video
// impossible and made even photos feel slow. Instead: upload the file over
// plain HTTP, get back a URL, and send that small URL through the socket
// like a normal chat message.
//
// Uploaded files are written to local disk and served back from
// `/uploads/<filename>`. NOTE: if you deploy this to a host with an
// ephemeral filesystem (e.g. Render's free tier), uploaded files will be
// wiped on every restart/redeploy/spin-down. If that matters for your
// deployment, point this at persistent disk (a mounted volume) or swap in
// your own object-storage provider here.
 
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { ipRateLimit } from '../middleware/rateLimitMiddleware.js';
 
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = path.resolve(__dirname, '../uploads');
 
const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15MB
const MAX_VIDEO_BYTES = 60 * 1024 * 1024; // 60MB
 
// Buffer the upload in memory, then write it to disk ourselves once
// validated (size/type checks happen before anything touches the disk).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_BYTES },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image or video files are allowed'));
    }
  }
});
 
function safeFilename(originalname) {
  const ext = path.extname(originalname || '').slice(0, 10);
  const safeExt = /^\.[a-zA-Z0-9]+$/.test(ext) ? ext : '';
  return `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${safeExt}`;
}
 
const router = express.Router();
 
// This endpoint isn't tied to a room/session, so without a limit it's an
// open door to spam storage with uploads. 20 uploads / 5 minutes per IP is
// plenty for real chat use and blunt against abuse.
const uploadLimiter = ipRateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: 'Too many uploads. Please wait a few minutes and try again.'
});
 
router.post('/upload', uploadLimiter, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'File is too large'
        : (err.message || 'Upload failed');
      return res.status(400).json({ error: message });
    }
 
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
 
    const mediaType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
    const maxBytes = mediaType === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
 
    if (req.file.size > maxBytes) {
      return res.status(400).json({
        error: mediaType === 'video' ? 'Video must be smaller than 60MB' : 'Image must be smaller than 15MB'
      });
    }
 
    const filename = safeFilename(req.file.originalname);
 
    try {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      fs.writeFileSync(path.join(UPLOAD_DIR, filename), req.file.buffer);
      const url = `${req.protocol}://${req.get('host')}/uploads/${filename}`;
      return res.json({ url, type: mediaType });
    } catch (e) {
      console.error('Media upload error:', e);
      return res.status(500).json({ error: 'Upload failed, please try again' });
    }
  });
});
 
export default router;
 
