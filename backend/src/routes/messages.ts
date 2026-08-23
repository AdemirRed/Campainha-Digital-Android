import { Router } from 'express';
import { MessageController } from '../controllers/MessageController';

export function createMessageRouter(): Router {
  const router = Router();
  const messageController = new MessageController();

  router.post('/', messageController.create.bind(messageController));

  return router;
}
