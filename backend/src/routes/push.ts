import { Router } from 'express';
import { PushController } from '../controllers/PushController';

export function createPushRouter(): Router {
  const router = Router();
  const controller = new PushController();

  router.get('/vapid-public-key', controller.vapidPublicKey.bind(controller));
  router.post('/subscribe', controller.subscribe.bind(controller));
  router.post('/unsubscribe', controller.unsubscribe.bind(controller));
  router.post('/ring', controller.ring.bind(controller));
  router.get('/presence', controller.presence.bind(controller));

  return router;
}
