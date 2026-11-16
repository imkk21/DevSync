import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { HiCode, HiArrowLeft, HiUserAdd, HiSave } from 'react-icons/hi';
import useAuthStore from '../store/authStore';
import useEditorStore from '../store/editorStore';
import useWorkspaceStore from '../store/workspaceStore';
import Sidebar from '../components/layout/Sidebar';
import FileTree from '../components/editor/FileTree';
import EditorTabs from '../components/editor/EditorTabs';
import CodeEditor from '../components/editor/CodeEditor';
import OutputPanel from '../components/editor/OutputPanel';
import InviteMemberModal from '../components/workspace/InviteMemberModal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { socketService } from '../services/socketService';

export default function EditorPage() {
  const { workspaceId } = useParams();
  const { user } = useAuthStore();
  const { fetchFiles, activeFile, saveFile, editorContent } = useEditorStore();
  const { currentWorkspace, members, fetchWorkspace, inviteMember } = useWorkspaceStore();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const activeFileRef = useRef(activeFile);

  const isOwner = !!user && currentWorkspace?.owner_id === user.id;
  const readOnly = members.find((m) => m.user_id === user?.id)?.role === 'viewer';

  // Keep ref in sync
  useEffect(() => {
    activeFileRef.current = activeFile;
  }, [activeFile]);

  // Fetch workspace and files
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchWorkspace(workspaceId);
      await fetchFiles(workspaceId);
      setLoading(false);
    };
    init();
  }, [workspaceId, fetchWorkspace, fetchFiles]);

  // Set up Socket.io for realtime
  useEffect(() => {
    if (!user || !workspaceId) return;

    socketService.connect(workspaceId);

    socketService.onPresenceUpdate((users) => {
      setOnlineUsers(users);
    });

    // Server never echoes back to the sending socket. Apply to every copy of the file,
    // not just the active one, so tabs never hold stale content.
    socketService.onCodeUpdate(({ fileId, content }) => {
      useEditorStore.getState().setFileContent(fileId, content);
    });

    return () => {
      socketService.disconnect();
    };
  }, [user?.id, workspaceId]);

  // Broadcast content changes via Socket.io
  const handleContentChange = useCallback(
    (content) => {
      const currentActiveFile = activeFileRef.current;

      if (currentActiveFile) {
        socketService.emitCodeChange(workspaceId, currentActiveFile.id, content);
      }
    },
    [workspaceId]
  );

  const handleInvite = async (email, role) => {
    const result = await inviteMember(workspaceId, email, role);
    if (!result?.error) {
      await fetchWorkspace(workspaceId);
    }
    return result;
  };

  const handleSave = () => {
    if (activeFile) {
      saveFile(activeFile.id, editorContent);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface-950">
        <LoadingSpinner size="xl" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-surface-950">
      {/* Top Bar */}
      <div className="h-12 flex items-center justify-between px-3 bg-surface-900/80 border-b border-surface-800 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-800 transition-colors"
            title="Back to Dashboard"
          >
            <HiArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <HiCode className="text-white text-sm" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white leading-tight">
                {currentWorkspace?.name || 'Workspace'}
              </h1>
              <p className="text-[10px] text-surface-500 leading-tight">
                {currentWorkspace?.default_language} • {activeFile?.name || 'No file selected'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleSave}
            disabled={!activeFile || readOnly}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-surface-400
              hover:text-white hover:bg-surface-800 transition-colors disabled:opacity-50"
            title="Save (Ctrl+S)"
          >
            <HiSave size={14} />
            <span className="hidden sm:inline">Save</span>
          </button>

          {isOwner && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-surface-400
                hover:text-white hover:bg-surface-800 transition-colors"
            >
              <HiUserAdd size={14} />
              <span className="hidden sm:inline">Invite</span>
            </button>
          )}

          {readOnly && (
            <span className="px-2 py-1 rounded text-[10px] font-semibold uppercase text-amber-400 bg-amber-500/10">
              View only
            </span>
          )}

          <div className="w-px h-5 bg-surface-800 mx-1" />

          {/* Online users mini */}
          <div className="flex -space-x-1.5">
            {onlineUsers.slice(0, 3).map((u, i) => (
              <div
                key={u.id}
                className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-400 to-purple-500 flex items-center justify-center
                  text-[10px] font-bold text-white border-2 border-surface-900"
                title={u.display_name}
              >
                {u.display_name?.[0]?.toUpperCase()}
              </div>
            ))}
            {onlineUsers.length > 3 && (
              <div className="w-6 h-6 rounded-full bg-surface-700 flex items-center justify-center text-[10px] text-surface-300
                border-2 border-surface-900">
                +{onlineUsers.length - 3}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main IDE Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* File Sidebar */}
        <Sidebar>
          <FileTree workspaceId={workspaceId} userId={user?.id} readOnly={readOnly} />
        </Sidebar>

        {/* Editor + Output */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <EditorTabs />
          <div className="flex-1 overflow-hidden">
            <CodeEditor onContentChange={handleContentChange} readOnly={readOnly} />
          </div>
          <OutputPanel />
        </div>
      </div>

      <InviteMemberModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInvite={handleInvite}
      />
    </div>
  );
}
