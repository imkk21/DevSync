import { Router } from 'express';
import authMiddleware from '../middleware/auth.js';
import {
  listFiles, getFile, createFile,
  updateFile, renameFile, deleteFile,
} from '../controllers/fileController.js';

const router = Router();

router.get('/:id/files', authMiddleware, listFiles);
router.get('/:id/files/:fileId', authMiddleware, getFile);
router.post('/:id/files', authMiddleware, createFile);
router.put('/:id/files/:fileId', authMiddleware, updateFile);
router.patch('/:id/files/:fileId/rename', authMiddleware, renameFile);
router.delete('/:id/files/:fileId', authMiddleware, deleteFile);

export default router;
