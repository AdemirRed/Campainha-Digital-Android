import { Express } from 'express';
import { requestLogger } from './requestLogger';
import { errorHandler } from './errorHandler';
import { rateLimiter } from './rateLimiter';

export function setupMiddleware(app: Express): void {
  app.use(requestLogger);
  app.use(rateLimiter);
  // Error handler should be last
  app.use(errorHandler);
}
