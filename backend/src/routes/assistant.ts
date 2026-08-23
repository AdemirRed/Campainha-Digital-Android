import { Router } from 'express';
import { AssistantController } from '../controllers/AssistantController';

export function createAssistantRouter(): Router {
  const router = Router();
  const assistantController = new AssistantController();

  router.post('/chat', assistantController.chat.bind(assistantController));
  router.get('/summary', assistantController.summary.bind(assistantController));

  return router;
}
