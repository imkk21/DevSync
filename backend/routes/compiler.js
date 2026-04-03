import { Router } from 'express';
import authMiddleware from '../middleware/auth.js';
import { runCode, getLanguages } from '../controllers/compilerController.js';

const router = Router();

router.post('/run', authMiddleware, runCode);
router.get('/languages', getLanguages);

export default router;
