import { Router } from 'express';
import authMiddleware from '../middleware/auth.js';
import { getProfile, updateProfile } from '../controllers/authController.js';

const router = Router();

router.get('/me', authMiddleware, getProfile);
router.put('/me', authMiddleware, updateProfile);

export default router;
