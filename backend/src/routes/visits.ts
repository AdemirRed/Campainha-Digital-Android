import { Router } from 'express';
import { VisitorController } from '../controllers/VisitorController';
import { auth } from '../middleware/auth';

export function createVisitsRouter(): Router {
  const router = Router();
  const c = new VisitorController();
  router.get('/', auth, c.timeline);
  router.post('/:id/name', auth, c.nameVisit);
  router.delete('/all', auth, c.clearVisits);
  router.delete('/:id', auth, c.deleteVisit);
  return router;
}
