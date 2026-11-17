import { Router } from 'express';
import authMiddleware from '../middleware/auth.js';
import {
  listWorkspaces, getWorkspace, createWorkspace,
  updateWorkspace, deleteWorkspace, inviteMember, removeMember,
  updateMemberRole, leaveWorkspace, transferOwnership,
  duplicateWorkspace, setPublicLink, listInvites, createInviteLink, revokeInvite,
} from '../controllers/workspaceController.js';
import { createCheckpoint } from '../controllers/fileController.js';
import { forkWorkspace, getForkChanges, mergeFork, setWatchTests } from '../controllers/reviewController.js';
import { getWall, freezeClass, sendHint, setHand, setRace, getRace } from '../controllers/classroomController.js';
import { getInsights } from '../controllers/peopleController.js';
import { getWebhook, saveWebhook, deleteWebhook, callToken } from '../controllers/integrationsController.js';

const router = Router();

router.use(authMiddleware);
router.get('/', listWorkspaces);
router.get('/:id', getWorkspace);
router.post('/', createWorkspace);
router.put('/:id', updateWorkspace);
router.delete('/:id', deleteWorkspace);
router.post('/:id/duplicate', duplicateWorkspace);
router.post('/:id/fork', forkWorkspace);
router.get('/:id/fork', getForkChanges);
router.post('/:id/fork/merge', mergeFork);
router.post('/:id/watch-tests', setWatchTests);
router.get('/:id/wall', getWall);
router.post('/:id/freeze', freezeClass);
router.post('/:id/hint', sendHint);
router.post('/:id/hand', setHand);
router.post('/:id/race', setRace);
router.get('/:id/race', getRace);
router.get('/:id/insights', getInsights);
router.get('/:id/webhook', getWebhook);
router.put('/:id/webhook', saveWebhook);
router.delete('/:id/webhook', deleteWebhook);
router.post('/:id/call', callToken);
router.post('/:id/public', setPublicLink);
router.post('/:id/checkpoint', createCheckpoint);
router.post('/:id/invite', inviteMember);
router.get('/:id/invites', listInvites);
router.post('/:id/invites', createInviteLink);
router.delete('/:id/invites/:inviteId', revokeInvite);
router.delete('/:id/members/:userId', removeMember);
router.patch('/:id/members/:userId', updateMemberRole);
router.post('/:id/leave', leaveWorkspace);
router.post('/:id/transfer', transferOwnership);

export default router;
