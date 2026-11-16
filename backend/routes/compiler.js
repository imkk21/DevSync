import { Router } from 'express';
import authMiddleware from '../middleware/auth.js';
import { runCode, runTests } from '../controllers/compilerController.js';

const router = Router();

router.post('/run', authMiddleware, runCode);
router.post('/test', authMiddleware, runTests);

export default router;
