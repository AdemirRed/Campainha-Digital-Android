import { Router } from 'express';
import { FaceController } from '../controllers/FaceController';
import { auth } from '../middleware/auth';

export function createFaceRouter(): Router {
  const router = Router();
  const faceController = new FaceController();

  router.post('/descriptor', auth, faceController.descriptor.bind(faceController));
  router.post('/recognize', auth, faceController.recognize.bind(faceController));

  return router;
}
