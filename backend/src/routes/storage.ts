import { Router } from 'express';
import { StorageController } from '../controllers/StorageController';

export function createStorageRouter(): Router {
  const router = Router();
  const storageController = new StorageController();

  router.get('/usage', storageController.usage.bind(storageController));

  return router;
}
