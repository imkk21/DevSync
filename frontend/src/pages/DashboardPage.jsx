import { useState, useEffect } from 'react';
import { HiPlus, HiSearch, HiViewGrid, HiViewList, HiRefresh } from 'react-icons/hi';
import Navbar from '../components/layout/Navbar';
import WorkspaceCard from '../components/workspace/WorkspaceCard';
import CreateWorkspaceModal from '../components/workspace/CreateWorkspaceModal';
import InviteMemberModal from '../components/workspace/InviteMemberModal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Button from '../components/ui/Button';
import useAuthStore from '../store/authStore';
import useWorkspaceStore from '../store/workspaceStore';

export default function DashboardPage() {
  const { user, profile } = useAuthStore();
  const { workspaces, loading, fetchWorkspaces, createWorkspace, deleteWorkspace, inviteMember } = useWorkspaceStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(null);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid');

  useEffect(() => {
    if (user) {
      fetchWorkspaces(user.id);
    }
  }, [user, fetchWorkspaces]);

  const handleCreate = async (name, description, language) => {
    return await createWorkspace(name, description, language, user.id);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this workspace? This action cannot be undone.')) {
      await deleteWorkspace(id);
    }
  };

  const handleInvite = async (email, role) => {
    return await inviteMember(selectedWorkspaceId, email, role);
  };

  const filteredWorkspaces = workspaces.filter((w) =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    w.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-surface-950">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 animate-fade-in">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Welcome back, <span className="gradient-text">{profile?.display_name || 'Developer'}</span>
            </h1>
            <p className="text-surface-400 text-sm mt-1">Manage your workspaces and start coding</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <HiPlus size={18} />
            New Workspace
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6 animate-fade-in">
          <div className="relative flex-1 max-w-md">
            <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" size={18} />
            <input
              type="text"
              className="input-field pl-10"
              placeholder="Search workspaces..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              id="search-workspaces"
            />
          </div>
          <div className="flex border border-surface-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-surface-800 text-white' : 'text-surface-500 hover:text-surface-300'}`}
            >
              <HiViewGrid size={18} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-surface-800 text-white' : 'text-surface-500 hover:text-surface-300'}`}
            >
              <HiViewList size={18} />
            </button>
          </div>
          <button
            onClick={() => fetchWorkspaces(user.id)}
            className="p-2 rounded-lg border border-surface-700 text-surface-500 hover:text-white hover:bg-surface-800 transition-colors"
            title="Refresh"
          >
            <HiRefresh size={18} />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="py-20">
            <LoadingSpinner size="lg" />
          </div>
        ) : filteredWorkspaces.length > 0 ? (
          <div className={`animate-fade-in ${
            viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5'
              : 'space-y-3'
          }`}>
            {filteredWorkspaces.map((workspace) => (
              <WorkspaceCard
                key={workspace.id}
                workspace={workspace}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 animate-fade-in">
            <div className="text-6xl mb-4 opacity-30">📁</div>
            <h3 className="text-lg font-medium text-surface-400 mb-2">
              {search ? 'No workspaces match your search' : 'No workspaces yet'}
            </h3>
            <p className="text-sm text-surface-600 mb-6">
              {search ? 'Try a different search term' : 'Create your first workspace to get started'}
            </p>
            {!search && (
              <Button onClick={() => setShowCreateModal(true)}>
                <HiPlus size={18} />
                Create Workspace
              </Button>
            )}
          </div>
        )}
      </main>

      <CreateWorkspaceModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreate}
      />

      <InviteMemberModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInvite={handleInvite}
      />
    </div>
  );
}
