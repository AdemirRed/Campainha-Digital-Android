import { Router } from 'express';
import { ResidentController } from '../controllers/ResidentController';
import { auth } from '../middleware/auth';

export function createResidentsRouter(): Router {
  const router = Router();
  const residentController = new ResidentController();

  router.post('/', auth, residentController.create.bind(residentController));
  router.get('/', auth, residentController.getAll.bind(residentController));
  router.get('/:id', auth, residentController.getById.bind(residentController));
  router.put('/:id', auth, residentController.update.bind(residentController));
  router.delete('/:id', auth, residentController.delete.bind(residentController));

  return router;
}
