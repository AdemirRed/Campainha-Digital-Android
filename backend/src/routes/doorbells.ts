import { Router } from 'express';
import { DoorbellController } from '../controllers/DoorbellController';
import { auth } from '../middleware/auth';

export function createDoorbellRouter(): Router {
  const router = Router();
  const c = new DoorbellController();
  router.get('/', c.list);
  router.post('/', auth, c.create);
  router.patch('/:id', auth, c.rename);
  router.delete('/:id', auth, c.remove);
  return router;
}
