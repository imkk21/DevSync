// Everything outside /api/workspaces and /api/compiler: invite links, public links, file history, account
import { Router } from 'express';
import authMiddleware from '../middleware/auth.js';
import { previewInvite, acceptInvite, claimInvites, getPublicWorkspace } from '../controllers/workspaceController.js';
import { restoreVersion, deleteAccount } from '../controllers/fileController.js';
import { acceptSuggestion, rejectSuggestion } from '../controllers/reviewController.js';
import { getPublicReplay, runPublic } from '../controllers/classroomController.js';

const router = Router();

router.get('/public/:token', getPublicWorkspace); // no sign-in
router.get('/public/:token/replay/:fileId', getPublicReplay); // no sign-in
router.post('/public/:token/run', runPublic); // no sign-in, rate limited per visitor
router.post('/invites/claim', authMiddleware, claimInvites);
router.get('/invites/:token', authMiddleware, previewInvite);
router.post('/invites/:token/accept', authMiddleware, acceptInvite);
router.post('/files/:id/restore', authMiddleware, restoreVersion);
router.post('/suggestions/:id/accept', authMiddleware, acceptSuggestion);
router.post('/suggestions/:id/reject', authMiddleware, rejectSuggestion);
router.delete('/me', authMiddleware, deleteAccount);

export default router;
