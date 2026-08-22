import { Router } from 'express';
import { DeliveryController } from '../controllers/DeliveryController';

export function createDeliveryRouter(): Router {
  const router = Router();
  const deliveryController = new DeliveryController();

  router.post('/', deliveryController.create.bind(deliveryController));
  router.get('/', deliveryController.getAll.bind(deliveryController));
  router.get('/:id', deliveryController.getById.bind(deliveryController));

  return router;
}
