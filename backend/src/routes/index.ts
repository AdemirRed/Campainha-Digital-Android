import { Express, Router } from 'express';
import eventRoutes from './events';
import deliveryRoutes from './deliveries';
import settingsRoutes from './settings';

export function setupRoutes(app: Express): void {
  const apiRouter = Router();

  apiRouter.use('/events', eventRoutes);
  apiRouter.use('/deliveries', deliveryRoutes);
  apiRouter.use('/settings', settingsRoutes);

  app.use('/api', apiRouter);
}
