import { Express, Router } from 'express';
import { createEventRouter } from './events';
import { createDeliveryRouter } from './deliveries';
import { createSettingsRouter } from './settings';

export function setupRoutes(app: Express): void {
  const apiRouter = Router();

  // Create routers after DB is initialized
  apiRouter.use('/events', createEventRouter());
  apiRouter.use('/deliveries', createDeliveryRouter());
  apiRouter.use('/settings', createSettingsRouter());

  app.use('/api', apiRouter);
}
