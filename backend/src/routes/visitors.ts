import { Router } from 'express';
import { VisitorController } from '../controllers/VisitorController';

export function createVisitorRouter(): Router {
  const router = Router();
  const visitorController = new VisitorController();

  router.post('/unrecognized', visitorController.recordUnrecognized.bind(visitorController));

  return router;
}
