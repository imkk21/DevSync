import { Router } from 'express';
import authMiddleware from '../middleware/auth.js';
import {
  listWorkspaces, getWorkspace, createWorkspace,
  updateWorkspace, deleteWorkspace, inviteMember, removeMember,
} from '../controllers/workspaceController.js';

const router = Router();

router.get('/', authMiddleware, listWorkspaces);
router.get('/:id', authMiddleware, getWorkspace);
router.post('/', authMiddleware, createWorkspace);
router.put('/:id', authMiddleware, updateWorkspace);
router.delete('/:id', authMiddleware, deleteWorkspace);
router.post('/:id/invite', authMiddleware, inviteMember);
router.delete('/:id/members/:userId', authMiddleware, removeMember);

export default router;
