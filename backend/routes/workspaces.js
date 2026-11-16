import { Router } from 'express';
import authMiddleware from '../middleware/auth.js';
import {
  listWorkspaces, getWorkspace, createWorkspace,
  updateWorkspace, deleteWorkspace, inviteMember, removeMember,
  updateMemberRole, leaveWorkspace, transferOwnership,
  duplicateWorkspace, setPublicLink, listInvites, createInviteLink, revokeInvite,
} from '../controllers/workspaceController.js';
import { createCheckpoint } from '../controllers/fileController.js';

const router = Router();

router.use(authMiddleware);
router.get('/', listWorkspaces);
router.get('/:id', getWorkspace);
router.post('/', createWorkspace);
router.put('/:id', updateWorkspace);
router.delete('/:id', deleteWorkspace);
router.post('/:id/duplicate', duplicateWorkspace);
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
