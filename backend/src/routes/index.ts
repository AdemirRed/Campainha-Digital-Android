import { Express, Router } from 'express';
import { createEventRouter } from './events';
import { createDeliveryRouter } from './deliveries';
import { createSettingsRouter } from './settings';
import { createResidentsRouter } from './residents';
import { createFaceRouter } from './face';

export function setupRoutes(app: Express): void {
  const apiRouter = Router();

  // Create routers after DB is initialized
  apiRouter.use('/events', createEventRouter());
  apiRouter.use('/deliveries', createDeliveryRouter());
  apiRouter.use('/settings', createSettingsRouter());
  apiRouter.use('/residents', createResidentsRouter());
  apiRouter.use('/face', createFaceRouter());

  app.use('/api', apiRouter);
}
