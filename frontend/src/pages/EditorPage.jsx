import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { GoAlert, GoArrowLeft, GoEye, GoPersonAdd, GoPlay, GoSidebarCollapse, GoSidebarExpand } from 'react-icons/go';
import useAuthStore from '../store/authStore';
import useEditorStore from '../store/editorStore';
import useWorkspaceStore from '../store/workspaceStore';
import FileTree from '../components/editor/FileTree';
import EditorTabs from '../components/editor/EditorTabs';
import CodeEditor from '../components/editor/CodeEditor';
import OutputPanel from '../components/editor/OutputPanel';
import InviteMemberModal from '../components/workspace/InviteMemberModal';
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import { PageLoader } from '../components/ui/LoadingSpinner';
import { MOD } from '../components/ui/Shortcut';
import ThemeMenu from '../components/ui/ThemeMenu';
import { socketService } from '../services/socketService';
import { getLanguage } from '../lib/languages';

const isSmallScreen = () => window.matchMedia('(max-width: 767px)').matches;

function Presence({ users, currentUserId }) {
  if (users.length === 0) return null;
  const shown = users.slice(0, 4);
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-1.5">
        {shown.map((u) => (
          <Avatar
            key={u.id}
            name={u.display_name || u.email}
            id={u.id}
            size={26}
            ring
            title={`${u.display_name || u.email}${u.id === currentUserId ? ' (you)' : ''}`}
          />
        ))}
        {users.length > shown.length && (
          <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-canvas-muted text-[11px] font-semibold text-ink-muted ring-2 ring-canvas">
            +{users.length - shown.length}
          </span>
        )}
      </div>
      <span className="hidden text-label-sm text-ink-muted lg:inline">{users.length} online</span>
    </div>
  );
}

function WorkspaceUnavailable() {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-canvas px-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-canvas-muted text-ink-muted">
        <GoAlert size={20} aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-headline-sm font-semibold text-ink">This workspace isn't available</h1>
      <p className="mt-2 max-w-sm text-body-sm text-ink-muted">It may have been deleted, or you don't have access to it.</p>
      <Link to="/dashboard" className="btn btn-md btn-secondary mt-6">
        <GoArrowLeft size={16} /> Back to workspaces
      </Link>
    </div>
  );
}

export default function EditorPage() {
  const { workspaceId } = useParams();
  const { user } = useAuthStore();
  const { fetchFiles, activeFile, saveFile, editorContent, language, isRunning, runCode } = useEditorStore();
  const { currentWorkspace, members, fetchWorkspace, inviteMember } = useWorkspaceStore();
  const [showShare, setShowShare] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(() => !isSmallScreen());
  const activeFileRef = useRef(activeFile);

  const isOwner = !!user && currentWorkspace?.owner_id === user.id;
  const readOnly = members.find((m) => m.user_id === user?.id)?.role === 'viewer';
  const runnable = !!getLanguage(language).judge0Id;

  // Keep ref in sync
  useEffect(() => {
    activeFileRef.current = activeFile;
  }, [activeFile]);

  // On phones the sidebar is an overlay: get it out of the way once a file is picked
  useEffect(() => {
    if (activeFile && isSmallScreen()) setSidebarOpen(false);
  }, [activeFile?.id]);

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

  if (loading) return <PageLoader label="Opening workspace…" />;
  if (currentWorkspace?.id !== workspaceId) return <WorkspaceUnavailable />;

  const filePath = activeFile?.path?.replace(/^\//, '') || activeFile?.name;

  return (
    <div className="flex h-screen flex-col bg-canvas">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center gap-1 border-b border-line bg-canvas px-2 sm:gap-2 sm:px-3">
        <Link to="/dashboard" className="icon-btn" aria-label="Back to workspaces" title="Back to workspaces">
          <GoArrowLeft size={16} />
        </Link>
        <button
          type="button"
          onClick={() => setSidebarOpen((o) => !o)}
          className="icon-btn"
          aria-pressed={sidebarOpen}
          aria-label={sidebarOpen ? 'Hide files' : 'Show files'}
          title={sidebarOpen ? 'Hide files' : 'Show files'}
        >
          {sidebarOpen ? <GoSidebarExpand size={16} /> : <GoSidebarCollapse size={16} />}
        </button>
        <div className="mx-1 hidden h-5 w-px bg-line sm:block" />

        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-body-sm">
          <span className="truncate font-semibold text-ink">{currentWorkspace.name}</span>
          {filePath && (
            <span className="hidden min-w-0 items-center gap-1.5 sm:flex">
              <span className="text-ink-subtle" aria-hidden="true">/</span>
              <span className="truncate text-ink-muted">{filePath}</span>
            </span>
          )}
        </nav>
        {readOnly && (
          <span className="badge ml-1 shrink-0">
            <GoEye size={12} aria-hidden="true" /> View only
          </span>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Presence users={onlineUsers} currentUserId={user?.id} />
          {onlineUsers.length > 0 && <div className="mx-1 hidden h-5 w-px bg-line sm:block" />}
          <ThemeMenu className="hidden sm:block" />
          {isOwner && (
            <Button variant="secondary" size="sm" onClick={() => setShowShare(true)} aria-label="Share workspace">
              <GoPersonAdd size={16} /> <span className="hidden sm:inline">Share</span>
            </Button>
          )}
          {!readOnly && (
            <Button variant="secondary" size="sm" onClick={handleSave} disabled={!activeFile} title={`Save (${MOD}+S)`} className="hidden sm:inline-flex">
              Save
            </Button>
          )}
          <Button
            size="sm"
            onClick={runCode}
            loading={isRunning}
            disabled={!activeFile || !runnable}
            title={!activeFile ? 'Open a file to run it' : runnable ? `Run (${MOD}+Enter)` : `${getLanguage(language).label} files can't be run`}
          >
            {!isRunning && <GoPlay size={16} />}
            {isRunning ? 'Running' : 'Run'}
          </Button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {sidebarOpen && (
          <>
            {/* Tap outside to close on phones */}
            <button
              type="button"
              aria-label="Close files"
              onClick={() => setSidebarOpen(false)}
              className="absolute inset-0 z-20 animate-fade-in bg-[#1F2328]/30 dark:bg-black/50 md:hidden"
            />
            <aside className="absolute inset-y-0 left-0 z-30 w-72 border-r border-line bg-canvas-subtle shadow-overlay md:static md:z-auto md:w-60 md:shadow-none lg:w-64">
              <FileTree workspaceId={workspaceId} userId={user?.id} readOnly={readOnly} />
            </aside>
          </>
        )}

        <main className="flex min-w-0 flex-1 flex-col">
          <EditorTabs />
          <div className="min-h-0 flex-1">
            <CodeEditor onContentChange={handleContentChange} readOnly={readOnly} />
          </div>
          <OutputPanel />
        </main>
      </div>

      <InviteMemberModal
        isOpen={showShare}
        onClose={() => setShowShare(false)}
        onInvite={handleInvite}
        members={members}
        currentUserId={user?.id}
      />
    </div>
  );
}
