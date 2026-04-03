import { useEffect } from 'react';
import useWorkspaceStore from '../store/workspaceStore';
import useAuthStore from '../store/authStore';

export default function useWorkspace(workspaceId) {
  const { user } = useAuthStore();
  const store = useWorkspaceStore();

  useEffect(() => {
    if (workspaceId) {
      store.fetchWorkspace(workspaceId);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (user && !workspaceId) {
      store.fetchWorkspaces(user.id);
    }
  }, [user]);

  return {
    workspaces: store.workspaces,
    currentWorkspace: store.currentWorkspace,
    members: store.members,
    loading: store.loading,
    error: store.error,
    createWorkspace: store.createWorkspace,
    deleteWorkspace: store.deleteWorkspace,
    inviteMember: store.inviteMember,
    fetchWorkspaces: store.fetchWorkspaces,
  };
}
