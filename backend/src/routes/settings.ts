import { Router } from 'express';
import { SettingsController } from '../controllers/SettingsController';
import { auth } from '../middleware/auth';

const router = Router();
const settingsController = new SettingsController();

// Settings require authentication
router.get('/', auth, settingsController.getAll.bind(settingsController));
router.get('/:key', auth, settingsController.get.bind(settingsController));
router.put('/:key', auth, settingsController.set.bind(settingsController));

export default router;
