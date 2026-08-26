import { Router } from 'express';
import { LiveController } from '../controllers/LiveController';

export function createLiveRouter(): Router {
  const router = Router();
  const liveController = new LiveController();

  router.post('/frame', liveController.pushFrame.bind(liveController));
  router.get('/status', liveController.status.bind(liveController));
  router.post('/stop', liveController.stop.bind(liveController));

  return router;
}
