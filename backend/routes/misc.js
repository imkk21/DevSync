// Everything outside /api/workspaces and /api/compiler: invite links, public links, file history, account
import { Router } from 'express';
import authMiddleware from '../middleware/auth.js';
import { previewInvite, acceptInvite, claimInvites, getPublicWorkspace } from '../controllers/workspaceController.js';
import { restoreVersion, deleteAccount } from '../controllers/fileController.js';

const router = Router();

router.get('/public/:token', getPublicWorkspace); // no sign-in
router.post('/invites/claim', authMiddleware, claimInvites);
router.get('/invites/:token', authMiddleware, previewInvite);
router.post('/invites/:token/accept', authMiddleware, acceptInvite);
router.post('/files/:id/restore', authMiddleware, restoreVersion);
router.delete('/me', authMiddleware, deleteAccount);

export default router;
