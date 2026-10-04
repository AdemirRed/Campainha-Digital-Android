import { Router } from 'express';
import { RecordingController } from '../controllers/RecordingController';
import { auth } from '../middleware/auth';

export function createRecordingsRouter(): Router {
  const router = Router();
  const recordingController = new RecordingController();

  router.post('/', recordingController.upload.bind(recordingController));
  router.get('/', recordingController.list.bind(recordingController));
  router.get('/:filename/thumb', recordingController.thumbnail.bind(recordingController));
  router.delete('/batch', auth, recordingController.deleteBatch.bind(recordingController));
  router.delete('/:filename', auth, recordingController.delete.bind(recordingController));

  return router;
}
