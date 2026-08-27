import { Express, Router } from 'express';
import { createEventRouter } from './events';
import { createDeliveryRouter } from './deliveries';
import { createSettingsRouter } from './settings';
import { createResidentsRouter } from './residents';
import { createMessageRouter } from './messages';
import { createVisitorRouter } from './visitors';
import { createAssistantRouter } from './assistant';
import { createStorageRouter } from './storage';
import { createRecordingsRouter } from './recordings';
import { createLiveRouter } from './live';
import { createPushRouter } from './push';
import { logger } from '../utils/logger';

export function setupRoutes(app: Express): void {
  const apiRouter = Router();

  // Create routers after DB is initialized
  apiRouter.use('/events', createEventRouter());
  apiRouter.use('/deliveries', createDeliveryRouter());
  apiRouter.use('/settings', createSettingsRouter());
  apiRouter.use('/residents', createResidentsRouter());
  apiRouter.use('/messages', createMessageRouter());
  apiRouter.use('/visitors', createVisitorRouter());
  apiRouter.use('/assistant', createAssistantRouter());
  apiRouter.use('/storage', createStorageRouter());
  apiRouter.use('/recordings', createRecordingsRouter());
  apiRouter.use('/live', createLiveRouter());
  apiRouter.use('/push', createPushRouter());

  // Face recognition depends on `canvas` (a native module) and
  // @vladmandic/face-api, which aren't installed on constrained hosts like
  // Termux (only the VPS backend needs them). Requiring it lazily, inside
  // a try/catch, means a host without those packages still serves every
  // other route instead of crashing on boot.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createFaceRouter } = require('./face');
    apiRouter.use('/face', createFaceRouter());
  } catch (err: any) {
    logger.warn(`Face recognition routes disabled (dependency missing): ${err.message}`);
  }

  // Visitor face identification/recognition shares the same face-api
  // dependency as resident recognition, so it's gated the same way.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { VisitorFaceController } = require('../controllers/VisitorFaceController');
    const visitorFaceController = new VisitorFaceController();
    const visitorFaceRouter = Router();
    visitorFaceRouter.post('/identify', visitorFaceController.identify.bind(visitorFaceController));
    visitorFaceRouter.post('/recognize', visitorFaceController.recognize.bind(visitorFaceController));
    apiRouter.use('/visitors', visitorFaceRouter);
  } catch (err: any) {
    logger.warn(`Visitor face recognition routes disabled (dependency missing): ${err.message}`);
  }

  app.use('/api', apiRouter);
}
