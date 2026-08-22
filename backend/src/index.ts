import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { setupMiddleware } from './middleware';
import { setupRoutes } from './routes';
import { Database } from './database';
import { logger } from './utils/logger';
import { ensureDirectories } from './utils/filesystem';

// Load environment variables
dotenv.config();

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
    contentSecurityPolicy: false // Disable for development, enable in production
  }));
  app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
      ? process.env.FRONTEND_URL 
      : 'http://localhost:5173',
    credentials: true
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Setup custom middleware
  setupMiddleware(app);

  // Static files (for serving frontend in production)
  if (process.env.NODE_ENV === 'production') {
    const frontendPath = path.join(__dirname, '../../../frontend/dist');
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
      const indexPath = path.join(__dirname, '../../../frontend/dist/index.html');
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

  // Start server
  app.listen(PORT, () => {
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
