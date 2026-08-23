import { Router } from 'express';
import { RecordingController } from '../controllers/RecordingController';

export function createRecordingsRouter(): Router {
  const router = Router();
  const recordingController = new RecordingController();

  router.post('/', recordingController.upload.bind(recordingController));
  router.get('/', recordingController.list.bind(recordingController));
  router.delete('/:filename', recordingController.delete.bind(recordingController));

  return router;
}
