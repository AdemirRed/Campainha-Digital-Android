import { Router } from 'express';
import { VisitorController } from '../controllers/VisitorController';
import { auth } from '../middleware/auth';

export function createVisitorRouter(): Router {
  const router = Router();
  const c = new VisitorController();
  router.get('/', auth, c.list);
  router.post('/unrecognized', c.recordUnrecognized.bind(c));
  router.patch('/:id', auth, c.rename);
  router.get('/:id/visits', auth, c.listVisits);
  return router;
}
