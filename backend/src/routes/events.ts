import { Router } from 'express';
import { EventController } from '../controllers/EventController';

export function createEventRouter(): Router {
  const router = Router();
  const eventController = new EventController();

  router.post('/', eventController.create.bind(eventController));
  router.get('/', eventController.getAll.bind(eventController));
  router.get('/:id', eventController.getById.bind(eventController));
  router.put('/:id', eventController.update.bind(eventController));
  router.delete('/:id', eventController.delete.bind(eventController));

  return router;
}
