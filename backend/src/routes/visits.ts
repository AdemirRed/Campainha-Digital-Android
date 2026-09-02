import { Router } from 'express';
import { VisitorController } from '../controllers/VisitorController';
import { auth } from '../middleware/auth';

export function createVisitsRouter(): Router {
  const router = Router();
  const c = new VisitorController();
  router.get('/', c.timeline);
  router.post('/:id/name', auth, c.nameVisit);
  return router;
}
