import { Router } from 'express';
import authMiddleware from '../middleware/auth.js';
import { runCode } from '../controllers/compilerController.js';

const router = Router();

router.post('/run', authMiddleware, runCode);

export default router;
