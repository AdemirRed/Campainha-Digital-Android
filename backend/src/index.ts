import './loadEnv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import http from 'http';
import { setupMiddleware } from './middleware';
import { setupRoutes } from './routes';
import { Database } from './database';
import { logger } from './utils/logger';
import { ensureDirectories } from './utils/filesystem';
import { attachSignalingServer } from './services/CallSignalingService';

const app = express();
const PORT = process.env.PORT || 3000;

// Main initialization function
async function startServer() {
  // Initialize database
  const db = Database.getInstance();
  await db.initialize();

  // Ensure required directories exist
  ensureDirectories();

  // Middleware
  app.use(helmet({
    contentSecurityPolicy: false, // Disable for development, enable in production
    // Same reasoning as the CORS origin:true below - this app is loaded
    // from several different device/IP origins on the same network, and
    // helmet's default "same-origin" CORP header silently blocks the
    // browser from using cross-origin video/audio/fetch responses even
    // when CORS itself allows them (ERR_BLOCKED_BY_RESPONSE.NotSameOrigin).
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  }));
  // The frontend is opened from whatever address each device on the local
  // network happens to use (localhost:3000 on the kiosk phone itself,
  // 192.168.x.x:3000 from a PC/tablet on the same Wi-Fi, the /notifications
  // page on a second device, etc). Pinning CORS to one fixed FRONTEND_URL
  // broke every other origin's requests. Since every route that touches
  // real data is already gated by the Bearer API_TOKEN, reflecting
  // whichever origin made the request (rather than a fixed allowlist) is
  // an acceptable tradeoff for this single-household deployment.
  app.use(cors({
    origin: true,
    credentials: true
  }));
  app.use(express.json({ limit: '25mb' })); // base64 photos/audio/short video clips
  app.use(express.urlencoded({ extended: true }));

  // Setup custom middleware
  setupMiddleware(app);

  // Serve uploaded media (audio messages, visitor recordings) so <audio>/
  // <video> tags in the admin panel can play them directly by URL.
  // express.static guesses Content-Type from the .webm extension alone,
  // which resolves to "video/webm" - <audio> elements refuse to play a
  // resource served with a video MIME type, so the audios subfolder
  // needs its Content-Type forced to audio/webm explicitly.
  app.use(
    '/storage/audios',
    express.static(process.env.AUDIOS_PATH || './data/storage/audios', {
      setHeaders: (res) => res.setHeader('Content-Type', 'audio/webm'),
    })
  );
  app.use('/storage', express.static(process.env.STORAGE_PATH || './data/storage'));

  // Static files (for serving frontend in production)
  if (process.env.NODE_ENV === 'production') {
    const frontendPath = path.join(__dirname, '../../../../frontend/dist');
    logger.info(`Serving static files from: ${frontendPath}`);
    app.use(express.static(frontendPath));
  }

  // API Routes
  setupRoutes(app);

  // Health check
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Serve frontend in production
  if (process.env.NODE_ENV === 'production') {
    app.get('*', (req, res) => {
      const indexPath = path.join(__dirname, '../../../../frontend/dist/index.html');
      res.sendFile(indexPath);
    });
  }

  // Error handling
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Internal server error'
    });
  });

  // Start server - a plain http.Server so the WebRTC call signaling
  // WebSocket server (wss://.../ws/calls) can share the same port/TLS
  // termination instead of needing a separate listener.
  const server = http.createServer(app);
  attachSignalingServer(server);

  server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, closing server...');
    db.close();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, closing server...');
    db.close();
    process.exit(0);
  });
}

// Start the server
startServer().catch(err => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
