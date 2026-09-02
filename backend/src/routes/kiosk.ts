import { Router } from 'express';
import { KioskController } from '../controllers/KioskController';
import { auth } from '../middleware/auth';

export function createKioskRouter(): Router {
  const router = Router();
  const c = new KioskController();
  router.get('/:doorbellId/lock', c.getLock);
  router.post('/:doorbellId/unlock', auth, c.unlock);
  router.post('/:doorbellId/lock', auth, c.lock);
  router.patch('/:doorbellId/lock-enabled', auth, c.setLockEnabled);
  return router;
}
