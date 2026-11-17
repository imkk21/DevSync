// Everything outside /api/workspaces and /api/compiler: invite links, public links, file history, account
import { Router } from 'express';
import authMiddleware from '../middleware/auth.js';
import { previewInvite, acceptInvite, claimInvites, getPublicWorkspace } from '../controllers/workspaceController.js';
import { restoreVersion, deleteAccount } from '../controllers/fileController.js';
import { acceptSuggestion, rejectSuggestion } from '../controllers/reviewController.js';
import { getPublicReplay, runPublic } from '../controllers/classroomController.js';
import { getPortfolio } from '../controllers/peopleController.js';
import { calendarIcs, getCalendarFeed, resetCalendarFeed, deleteCalendarFeed, savePushDevice, deletePushDevice } from '../controllers/integrationsController.js';
import { pushKey } from '../services/push.js';

const router = Router();

router.get('/public/:token', getPublicWorkspace); // no sign-in
router.get('/public/:token/replay/:fileId', getPublicReplay); // no sign-in
router.post('/public/:token/run', runPublic); // no sign-in, rate limited per visitor
router.get('/u/:username', getPortfolio); // no sign-in
router.get('/calendar/:token.ics', calendarIcs); // no sign-in: the token is the key
router.get('/me/calendar', authMiddleware, getCalendarFeed);
router.post('/me/calendar', authMiddleware, resetCalendarFeed);
router.delete('/me/calendar', authMiddleware, deleteCalendarFeed);
router.get('/push/key', (req, res) => res.json({ key: pushKey })); // public: browsers need it to subscribe
router.post('/me/push', authMiddleware, savePushDevice);
router.delete('/me/push', authMiddleware, deletePushDevice);
router.post('/invites/claim', authMiddleware, claimInvites);
router.get('/invites/:token', authMiddleware, previewInvite);
router.post('/invites/:token/accept', authMiddleware, acceptInvite);
router.post('/files/:id/restore', authMiddleware, restoreVersion);
router.post('/suggestions/:id/accept', authMiddleware, acceptSuggestion);
router.post('/suggestions/:id/reject', authMiddleware, rejectSuggestion);
router.delete('/me', authMiddleware, deleteAccount);

export default router;
