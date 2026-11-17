import { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { VscGithub } from 'react-icons/vsc';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  GoAlert, GoArrowLeft, GoCheck, GoCloudOffline, GoComment, GoCommentDiscussion, GoCommandPalette, GoEye,
  GoFileDirectory, GoHistory, GoPersonAdd, GoPlay, GoPulse, GoScreenFull, GoSearch, GoSidebarCollapse,
  GoSidebarExpand, GoX, GoBookmark, GoDownload, GoDuplicate, GoGear, GoVideo, GoStopwatch, GoPeople, GoRepoForked, GoMortarBoard, GoPaperclip, GoDeviceCameraVideo, GoBell,
} from 'react-icons/go';
import useAuthStore from '../store/authStore';
import useEditorStore from '../store/editorStore';
import useWorkspaceStore from '../store/workspaceStore';
import useSettingsStore from '../store/settingsStore';
import useThemeStore from '../store/themeStore';
import { toast } from '../store/toastStore';
import FileTree from '../components/editor/FileTree';
import EditorTabs from '../components/editor/EditorTabs';
import CodeEditor, { EmptyState, runEditorAction } from '../components/editor/CodeEditor';
import OutputPanel from '../components/editor/OutputPanel';
import SearchPanel from '../components/editor/SearchPanel';
import CommentsPanel from '../components/editor/CommentsPanel';
import ChatPanel from '../components/editor/ChatPanel';
import ActivityPanel from '../components/editor/ActivityPanel';
import PreviewPane, { previewTarget, graphable } from '../components/editor/PreviewPane';
import CommandPalette from '../components/editor/CommandPalette';
import SettingsModal from '../components/editor/SettingsModal';
import ShortcutsModal from '../components/editor/ShortcutsModal';
import HistoryModal from '../components/editor/HistoryModal';
import ReplayModal from '../components/editor/ReplayModal';
import CodeImageModal from '../components/editor/CodeImageModal';
import CheckpointModal from '../components/editor/CheckpointModal';
import InterviewBar from '../components/editor/InterviewBar';
import Tour, { tourDone } from '../components/editor/Tour';
import ReactionPicker from '../components/editor/ReactionPicker';
import SuggestModal from '../components/editor/SuggestModal';
import ForkMergeModal from '../components/editor/ForkMergeModal';
import ClassroomBar from '../components/editor/ClassroomBar';
import Announcer from '../components/editor/Announcer';
import { FocusButton, CheckinCard, useLateNightNudge } from '../components/editor/TeamHealth';
import FlashcardModal from '../components/ui/FlashcardModal';
import { celebrate } from '../lib/celebrate';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { languageForFile } from '../lib/languages';
import { withoutAmd } from '../lib/diagrams';

// Big, separate chunks: only downloaded when used
// Excalidraw's bundled libraries trip over Monaco's AMD loader, so load it with that hidden
const WhiteboardEditor = lazy(() => withoutAmd(() => import('../components/editor/WhiteboardEditor')));
const TasksView = lazy(() => import('../components/views/TasksView'));
const WikiView = lazy(() => import('../components/views/WikiView'));
const EventsView = lazy(() => import('../components/views/EventsView'));
const AssetsPanel = lazy(() => import('../components/editor/AssetsPanel'));
const InsightsView = lazy(() => import('../components/views/InsightsView'));
const CallPanel = lazy(() => import('../components/editor/CallPanel'));
const AlertsModal = lazy(() => import('../components/workspace/AlertsModal'));
const GitHubModal = lazy(() => import('../components/workspace/GitHubModal'));

const VIEWS = [
  { id: 'code', label: 'Code' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'wiki', label: 'Wiki' },
  { id: 'events', label: 'Events' },
  { id: 'insights', label: 'Insights', owner: true },
];
const ViewLoading = () => <div className="flex h-full items-center justify-center"><LoadingSpinner size="lg" className="text-brand" /></div>;
import { api } from '../lib/api';
import InviteMemberModal from '../components/workspace/InviteMemberModal';
import NotificationBell from '../components/layout/NotificationBell';
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import DropdownMenu from '../components/ui/DropdownMenu';
import { PageLoader } from '../components/ui/LoadingSpinner';
import { MOD } from '../components/ui/Shortcut';
import ThemeMenu from '../components/ui/ThemeMenu';
import { socketService } from '../services/socketService';
import { getLanguage } from '../lib/languages';
import { supabase } from '../lib/supabase';
import useResizable from '../hooks/useResizable';

const isSmallScreen = () => window.matchMedia('(max-width: 767px)').matches;
const isTyping = (el) => el?.closest?.('input, textarea, select, [contenteditable="true"], .monaco-editor');

// Online people. Click someone to follow them: your editor goes where they go.
function Presence({ users, currentUserId, following, onFollow }) {
  if (users.length === 0) return null;
  const shown = users.slice(0, 4);
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-1.5">
        {shown.map((u) => {
          const me = u.id === currentUserId;
          const name = u.display_name || u.email;
          return (
            <button
              key={u.id}
              type="button"
              disabled={me}
              onClick={() => onFollow(following === u.id ? null : u.id)}
              aria-pressed={following === u.id}
              title={me ? `${name} (you)` : following === u.id ? `Stop following ${name}` : `Follow ${name}`}
              className={`rounded-full ${following === u.id ? 'relative z-10 ring-2 ring-brand ring-offset-1 ring-offset-canvas' : ''}`}
            >
              <Avatar name={name} id={u.id} src={u.avatar_url} size={26} ring />
            </button>
          );
        })}
        {users.length > shown.length && (
          <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-canvas-muted text-[11px] font-semibold text-ink-muted ring-2 ring-canvas">
            +{users.length - shown.length}
          </span>
        )}
      </div>
      <span className="hidden text-label-sm text-ink-muted xl:inline">{users.length} online</span>
    </div>
  );
}

// "next in 4:12" for mob mode
function Countdown({ to }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.round((to - Date.now()) / 1000));
  return <span className="font-mono tabular-nums">{Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}</span>;
}

// Autosave and connection state for the top bar
function SaveStatus({ connection, status, readOnly }) {
  let body = null;
  if (connection === 'offline') {
    body = (
      <span className="badge border-danger/25 bg-danger-soft text-danger" title="Your edits are kept and will sync when you reconnect">
        <GoCloudOffline size={12} aria-hidden="true" /> Offline
      </span>
    );
  } else if (connection === 'connecting') {
    body = <span className="text-label-sm text-ink-muted">Connecting…</span>;
  } else if (!readOnly && status === 'unsaved') {
    body = <span className="text-label-sm text-ink-muted">Saving…</span>;
  } else if (!readOnly && status === 'saved') {
    body = (
      <span className="inline-flex items-center gap-1 text-label-sm text-ink-muted">
        <GoCheck size={14} aria-hidden="true" /> Saved
      </span>
    );
  }
  return <div aria-live="polite" className="hidden shrink-0 lg:block">{body}</div>;
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

const PANELS = [
  { id: 'files', label: 'Files', icon: GoFileDirectory },
  { id: 'search', label: `Search (${MOD}+Shift+F)`, icon: GoSearch },
  { id: 'comments', label: 'Comments', icon: GoComment },
  { id: 'chat', label: 'Chat', icon: GoCommentDiscussion },
  { id: 'activity', label: 'Activity', icon: GoPulse },
  { id: 'assets', label: 'Shared files', icon: GoPaperclip },
];

// Split pane: a second editor on any open file
function SplitPane({ fileId, readOnly, onClose }) {
  const { openFiles, setRightPane } = useEditorStore();
  return (
    <section aria-label="Split editor" className="flex h-full min-w-0 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-line bg-canvas-subtle pl-2 pr-1.5">
        <label htmlFor="split-file" className="sr-only">File in split pane</label>
        <select
          id="split-file"
          value={fileId}
          onChange={(e) => setRightPane({ type: 'split', fileId: e.target.value })}
          className="h-7 min-w-0 max-w-[60%] cursor-pointer truncate rounded-md border border-transparent bg-transparent pl-1.5 pr-6 text-label-md text-ink hover:border-line-strong"
        >
          {openFiles.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <button type="button" onClick={onClose} className="icon-btn ml-auto h-7 w-7" aria-label="Close split" title="Close split">
          <GoX size={14} />
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <CodeEditor key={fileId} fileId={fileId} readOnly={readOnly} primary={false} />
      </div>
    </section>
  );
}

export default function EditorPage() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();
  const {
    fetchFiles, activeFile, activeFileId, saveFile, language, isRunning, runCode, connection, reset, files,
    presence, driver, following, follow, rightPane, setRightPane, zen, toggleZen, sidebarPanel, setSidebarPanel,
    unreadChat, downloadZip, openFiles, rotation, inkMode, toggleInk, frozen, spectators,
  } = useEditorStore();
  const [raceTick, setRaceTick] = useState(0);
  const authorship = useSettingsStore((s) => s.authorship);
  const activeStatus = useEditorStore((s) => s.fileStatus[s.activeFileId]);
  const { currentWorkspace, members, fetchWorkspace, inviteMember, updateWorkspace, duplicateWorkspace } = useWorkspaceStore();
  const [modal, setModal] = useState(null); // share | settings | shortcuts | history | replay | checkpoint | tour
  const [palette, setPalette] = useState(null); // files | commands | line
  const [imageRequest, setImageRequest] = useState(null);
  const [commentDraft, setCommentDraft] = useState(null);
  const [reacting, setReacting] = useState(null); // { fileId, line, offset }
  const [suggesting, setSuggesting] = useState(null); // { fileId, start, end, original, line }
  const [view, setView] = useState('code'); // code | tasks | wiki
  const [taskDraft, setTaskDraft] = useState(null); // from "Make a task from this line"
  const [cardDraft, setCardDraft] = useState(null); // new flashcard from selected code or a failed test
  const [call, setCall] = useState(null); // { url, token } while you're in the huddle
  const inCall = useRef(false);
  inCall.current = !!call;
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(() => !isSmallScreen());
  const sidebar = useResizable({ storageKey: 'devsync:sidebar-width', initial: 272, min: 200, max: 480 });
  const split = useResizable({ storageKey: 'devsync:split-width', initial: 480, min: 240, max: 1200, direction: -1 });
  const lastError = useRef({ message: '', at: 0 });

  const myRole = members.find((m) => m.user_id === user?.id)?.role;
  const isOwner = !!user && currentWorkspace?.owner_id === user.id;
  const canEdit = myRole === 'owner' || myRole === 'editor';
  const navigating = !!driver && driver !== user?.id; // pair mode, someone else drives
  const readOnly = !canEdit || navigating || (frozen && !isOwner);
  const runnable = !!getLanguage(language).judge0Id;
  const people = useMemo(
    () => members.map((m) => ({ id: m.user_id, name: m.profiles?.display_name || m.profiles?.email || 'Someone', avatar_url: m.profiles?.avatar_url })),
    [members],
  );
  const nameOf = (id) => people.find((p) => p.id === id)?.name || 'Someone';
  const views = VIEWS.filter((v) => !v.owner || isOwner);
  const joinCall = async () => {
    if (inCall.current) return;
    try {
      setCall(await api(`/api/workspaces/${workspaceId}/call`, { method: 'POST' }));
      socketService.collab?.signal('call', { joined: true }); // others get a Join button
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  };
  useLateNightNudge();

  // On phones the sidebar is an overlay: get it out of the way once a file is picked
  useEffect(() => {
    if (activeFile && isSmallScreen()) setSidebarOpen(false);
  }, [activeFile?.id]);

  // Fetch workspace, files, comments and chat
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      reset();
      const store = useEditorStore.getState();
      await fetchWorkspace(workspaceId);
      await fetchFiles(workspaceId);
      const [{ data: comments }, { data: messages }, { data: reactions }, { data: pastes }, { data: suggestions }] = await Promise.all([
        supabase.from('comments').select('*').eq('workspace_id', workspaceId).order('created_at'),
        supabase.from('messages').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(100),
        supabase.from('reactions').select('*').eq('workspace_id', workspaceId),
        supabase.from('paste_events').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(500),
        supabase.from('suggestions').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(300),
      ]);
      store.setSuggestions(suggestions || []);
      store.setComments(comments || []);
      store.setMessages((messages || []).reverse());
      store.setReactions(reactions || []);
      store.setPastes(pastes || []);
      setLoading(false);
    };
    init();
  }, [workspaceId, fetchWorkspace, fetchFiles, reset]);

  // Links from notifications: ?file=<id> opens a file, ?panel=chat opens a panel
  useEffect(() => {
    if (loading) return;
    const fileId = searchParams.get('file');
    const panel = searchParams.get('panel');
    const linkedView = searchParams.get('view');
    if (VIEWS.some((v) => v.id === linkedView)) {
      setView(linkedView);
      setSearchParams({}, { replace: true });
      return;
    }
    if (!fileId && !panel) return;
    const file = files.find((f) => f.id === fileId);
    if (file) useEditorStore.getState().openFile(file);
    if (panel || fileId) {
      setSidebarOpen(true);
      setSidebarPanel(panel || 'comments');
    }
    setSearchParams({}, { replace: true });
  }, [loading, searchParams]);

  // Real-time editing, presence, cursors and pair mode (Socket.io + Yjs)
  useEffect(() => {
    if (!user || !workspaceId) return;
    const store = useEditorStore.getState();
    socketService.connect(workspaceId, {
      onConnection: store.setConnection,
      onJoin: (res) => {
        if (res.error) return;
        store.setDriver(res.driver ?? null, res.rotation);
        store.setFrozen(!!res.frozen);
        store.setSpectators(res.spectators || 0);
      },
      onPresence: store.setPresence,
      onFileStatus: store.setFileStatus,
      onText: store.setFileContent,
      onDriver: (userId, rotation) => {
        store.setDriver(userId, rotation);
        if (userId && userId !== user.id) {
          const p = useWorkspaceStore.getState().members.find((m) => m.user_id === userId)?.profiles;
          toast(`${p?.display_name || p?.email || 'Someone'} is driving. You can watch and point.`);
        }
      },
      onError: (message) => {
        // The same rejection repeats for every keystroke; say it once
        const now = Date.now();
        if (lastError.current.message === message && now - lastError.current.at < 5000) return;
        lastError.current = { message, at: now };
        toast(message, { tone: 'error' });
      },
      onEvent: (event, payload) => {
        if (event === 'run:new') {
          store.addRun(payload);
          if (payload.user_id !== user.id) {
            const file = useEditorStore.getState().files.find((f) => f.id === payload.file_id);
            toast(`${payload.user_name} ran ${file?.name || 'a file'}: ${payload.status}`);
          }
        }
        if (event === 'workspace:updated') useWorkspaceStore.getState().setCurrentWorkspace(payload);
        if (event === 'suggestion:decided') store.upsertSuggestion(payload);
        if (event === 'spectators') store.setSpectators(payload.count);
        if (event === 'spectate:chat') {
          store.addViewerChat(payload);
          if (!payload.host && useEditorStore.getState().sidebarPanel !== 'chat') toast(`Viewer ${payload.name}: ${payload.text}`, { action: { label: 'Reply', onClick: () => openPanel('chat') } });
        }
        if (event === 'classroom:frozen') {
          store.setFrozen(payload.frozen);
          toast(payload.frozen ? 'Your teacher paused editing for a moment' : 'You can type again', { tone: payload.frozen ? 'info' : 'success' });
        }
        if (event === 'classroom:hint') {
          toast(`Your teacher added ${payload.path.slice(1)}`, {
            tone: 'success',
            action: { label: 'Open', onClick: () => { const f = useEditorStore.getState().files.find((x) => x.path === payload.path); if (f) useEditorStore.getState().openFile(f); } },
          });
        }
        if (event === 'race') {
          setRaceTick((n) => n + 1);
          if (payload.endsAt) toast('The race has started. Make the tests pass!', { tone: 'success' });
        }
        if (event === 'tests:watch') {
          store.setWatchResult(payload);
          const file = useEditorStore.getState().files.find((f) => f.id === payload.fileId);
          const who = (id) => {
            if (id === user.id) return 'Your';
            const p = useWorkspaceStore.getState().members.find((m) => m.user_id === id)?.profiles;
            return `${p?.display_name || p?.email || 'Someone'}'s`;
          };
          if (payload.broken.length) {
            toast(`${who(payload.brokenBy)} last edit broke ${payload.broken.length} ${payload.broken.length === 1 ? 'test' : 'tests'} in ${file?.name || 'a file'}`, { tone: 'error' });
          } else if (payload.fixed) {
            toast(`All tests pass again in ${file?.name || 'a file'}`, { tone: 'success' });
            celebrate();
          }
        }
        if (event === 'signal') {
          window.dispatchEvent(new CustomEvent('devsync:signal', { detail: payload }));
          // A ping on a file you're not looking at: offer to go there
          const { type, data, from } = payload;
          if (type === 'call' && !inCall.current) {
            toast(`${from.display_name || 'Someone'} joined the huddle`, { action: { label: 'Join', onClick: () => joinCall() }, duration: 15000 });
          }
          if (type === 'ping' && data.fileId !== useEditorStore.getState().activeFileId) {
            const file = useEditorStore.getState().files.find((f) => f.id === data.fileId);
            if (file) toast(`${from.display_name || 'Someone'} is pointing at line ${data.line} of ${file.name}`, { action: { label: 'Go', onClick: () => useEditorStore.getState().revealAt(file.id, { line: data.line }) } });
          }
        }
      },
      onRoleChanged: () => fetchWorkspace(workspaceId),
      onRemoved: () => navigate('/dashboard', { replace: true, state: { notice: 'You no longer have access to that workspace.' } }),
    });
    return () => socketService.disconnect();
  }, [user?.id, workspaceId]);

  // Live changes from others: files, comments, chat (Supabase Realtime)
  useEffect(() => {
    const store = () => useEditorStore.getState();
    const scope = (table) => ({ schema: 'public', table, filter: `workspace_id=eq.${workspaceId}` });
    const channel = supabase
      .channel(`workspace:${workspaceId}`)
      .on('postgres_changes', { event: 'INSERT', ...scope('files') }, (p) => store().applyRemoteFileChange(p))
      .on('postgres_changes', { event: 'UPDATE', ...scope('files') }, (p) => store().applyRemoteFileChange(p))
      // Delete events can't be filtered; the store ignores ids it doesn't know
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'files' }, (p) => store().applyRemoteFileChange(p))
      .on('postgres_changes', { event: 'INSERT', ...scope('comments') }, ({ new: row }) => store().upsertComment(row))
      .on('postgres_changes', { event: 'UPDATE', ...scope('comments') }, ({ new: row }) => store().upsertComment(row))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'comments' }, ({ old }) => store().removeComment(old.id))
      .on('postgres_changes', { event: 'INSERT', ...scope('messages') }, ({ new: row }) => store().addMessage(row, row.user_id !== useAuthStore.getState().user?.id))
      .on('postgres_changes', { event: 'INSERT', ...scope('suggestions') }, ({ new: row }) => store().upsertSuggestion(row))
      .on('postgres_changes', { event: 'UPDATE', ...scope('suggestions') }, ({ new: row }) => store().upsertSuggestion(row))
      .on('postgres_changes', { event: 'INSERT', ...scope('reactions') }, ({ new: row }) => store().upsertReaction(row))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'reactions' }, ({ old }) => store().removeReaction(old.id))
      .on('postgres_changes', { event: 'INSERT', ...scope('paste_events') }, ({ new: row }) => store().addPaste(row))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [workspaceId]);

  // Warn before leaving with edits the server hasn't saved yet
  useEffect(() => {
    const warn = (e) => {
      if (!socketService.collab?.hasUnsaved()) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  // Requests from inside the editor (context menu, gutter clicks)
  useEffect(() => {
    const onAction = ({ detail }) => {
      if (detail.type === 'comment') {
        setSidebarOpen(true);
        setSidebarPanel('comments');
        setCommentDraft(detail);
      } else if (detail.type === 'show-comments') {
        setSidebarOpen(true);
        setSidebarPanel('comments');
      } else if (detail.type === 'suggest') {
        setSuggesting(detail);
      } else if (detail.type === 'task') {
        setTaskDraft(detail);
        setView('tasks');
      } else if (detail.type === 'flashcard') {
        setCardDraft({ ...detail, workspaceId: useWorkspaceStore.getState().currentWorkspace?.id, source: detail.source || 'code' });
      } else if (detail.type === 'react') {
        setReacting(detail);
      } else if (detail.type === 'ping') {
        socketService.collab?.signal('ping', { fileId: detail.fileId, line: detail.line });
        window.dispatchEvent(new CustomEvent('devsync:signal', { detail: { type: 'ping', data: detail, from: { id: user.id } } }));
      } else if (detail.type === 'image') {
        const file = useEditorStore.getState().files.find((f) => f.id === detail.fileId);
        setImageRequest({ text: detail.text, language: detail.language, fileName: file?.name });
      }
    };
    window.addEventListener('devsync:action', onAction);
    return () => window.removeEventListener('devsync:action', onAction);
  }, []);

  // First visit: a short tour
  useEffect(() => {
    if (!loading && currentWorkspace?.id === workspaceId && !tourDone() && !isSmallScreen()) setModal('tour');
  }, [loading]);

  const openPanel = (id) => {
    setSidebarOpen(true);
    setSidebarPanel(id);
  };
  const startMob = async (minutes) => {
    const res = await socketService.collab?.rotate(minutes);
    if (res?.error) toast(res.error, { tone: 'error' });
  };
  const setPair = async (userId) => {
    const res = await socketService.collab?.setDriver(userId);
    if (res?.error) toast(res.error, { tone: 'error' });
  };
  const setInterview = async (on) => {
    const { error } = await updateWorkspace(workspaceId, { interview: on });
    if (error) toast(error.message, { tone: 'error' });
  };
  const fork = async () => {
    try {
      const copy = await api(`/api/workspaces/${workspaceId}/fork`, { method: 'POST' });
      toast('Fork created. Try your idea, then use Review and merge.', { tone: 'success' });
      navigate(`/editor/${copy.id}`);
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  };
  const duplicate = async () => {
    const { data, error } = await duplicateWorkspace(workspaceId);
    if (error) return toast(error.message, { tone: 'error' });
    toast('Copy created', { tone: 'success', action: { label: 'Open', onClick: () => navigate(`/editor/${data.id}`) } });
  };

  const commands = useMemo(() => {
    const vim = useSettingsStore.getState().vim;
    const wrap = useSettingsStore.getState().wordWrap;
    const others = presence.filter((u) => u.id !== user?.id);
    return [
      { id: 'files', label: 'Go to file…', shortcut: [MOD, 'P'], run: () => setPalette('files') },
      { id: 'line', label: 'Go to line…', shortcut: [MOD, 'G'], hidden: !activeFile, run: () => setPalette('line') },
      { id: 'search', label: 'Search in all files', shortcut: [MOD, 'Shift', 'F'], run: () => openPanel('search') },
      { id: 'save', label: 'Save now', shortcut: [MOD, 'S'], hidden: !activeFile || readOnly, run: () => saveFile(activeFileId) },
      { id: 'run', label: 'Run', shortcut: [MOD, 'Enter'], hidden: !activeFile || !runnable, run: runCode },
      { id: 'format', label: 'Format document', shortcut: ['Shift', 'Alt', 'F'], hidden: !activeFile || readOnly, run: () => runEditorAction('editor.action.formatDocument') },
      { id: 'find', label: 'Find in file', shortcut: [MOD, 'F'], hidden: !activeFile, run: () => runEditorAction('actions.find') },
      { id: 'split', label: rightPane?.type === 'split' ? 'Close split editor' : 'Split editor', shortcut: [MOD, '\\'], hidden: !activeFile, run: () => setRightPane(rightPane?.type === 'split' ? null : { type: 'split', fileId: activeFileId }) },
      { id: 'preview', label: rightPane?.type === 'preview' ? 'Close preview' : 'Open preview', hidden: !previewTarget(activeFile, files, rightPane?.fileId), run: () => setRightPane(rightPane?.type === 'preview' ? null : { type: 'preview', fileId: previewTarget(activeFile, files, rightPane?.fileId).id }) },
      { id: 'zen', label: zen ? 'Leave zen mode' : 'Zen mode: just the code', run: () => toggleZen() },
      { id: 'sidebar', label: sidebarOpen ? 'Hide side panel' : 'Show side panel', shortcut: [MOD, 'B'], run: () => setSidebarOpen((o) => !o) },
      { id: 'comments', label: 'Show comments', run: () => openPanel('comments') },
      { id: 'add-comment', label: 'Comment on this line', hidden: !activeFile, run: () => runEditorAction('devsync.comment') },
      { id: 'chat', label: 'Open chat', run: () => openPanel('chat') },
      { id: 'activity', label: 'Show activity and access log', run: () => openPanel('activity') },
      { id: 'image', label: 'Share code as image', hidden: !activeFile, run: () => runEditorAction('devsync.image') },
      { id: 'history', label: 'File history', hidden: !activeFile, run: () => setModal('history') },
      { id: 'replay', label: 'Replay how this file was written', hidden: !activeFile, run: () => setModal('replay') },
      { id: 'checkpoint', label: 'Save a checkpoint…', hidden: !canEdit, run: () => setModal('checkpoint') },
      { id: 'zip', label: 'Download workspace as zip', run: () => downloadZip(currentWorkspace?.name || 'workspace') },
      { id: 'duplicate', label: 'Duplicate workspace', run: duplicate },
      { id: 'fork', label: 'Fork to try an idea', run: fork },
      { id: 'merge', label: 'Review and merge this fork', hidden: !currentWorkspace?.fork_of, run: () => setModal('merge') },
      { id: 'suggest', label: 'Suggest a change here', hidden: !activeFile, run: () => runEditorAction('devsync.suggest') },
      { id: 'share', label: 'Share…', hidden: !isOwner, run: () => setModal('share') },
      { id: 'pair-start', label: 'Start pair mode (you drive)', hidden: !canEdit || !!driver, run: () => setPair(user.id) },
      { id: 'pair-take', label: 'Take the wheel', hidden: !canEdit || !driver || driver === user?.id, run: () => setPair(user.id) },
      { id: 'pair-end', label: rotation ? 'End mob mode' : 'End pair mode', hidden: !driver || (driver !== user?.id && !isOwner), run: () => setPair(null) },
      ...[5, 10, 15].map((m) => ({ id: `mob-${m}`, label: `Mob mode: pass the keyboard every ${m} minutes`, hidden: !canEdit, run: () => startMob(m) })),
      { id: 'ink', label: inkMode ? 'Stop drawing' : 'Draw on the code', hidden: !activeFile, run: () => toggleInk() },
      { id: 'ping', label: 'Point everyone to this line', hidden: !activeFile, run: () => runEditorAction('devsync.ping') },
      { id: 'react', label: 'React to this line', hidden: !activeFile, run: () => runEditorAction('devsync.react') },
      { id: 'authorship', label: authorship ? 'Hide who wrote what' : 'Show who wrote what', run: () => useSettingsStore.getState().update({ authorship: !authorship }) },
      { id: 'pastes', label: 'Highlight pasted code', run: () => useSettingsStore.getState().update({ highlightPastes: !useSettingsStore.getState().highlightPastes }) },
      ...others.map((u) => ({ id: `follow-${u.id}`, label: following === u.id ? `Stop following ${u.display_name}` : `Follow ${u.display_name || u.email}`, run: () => follow(following === u.id ? null : u.id) })),
      ...(isOwner && driver ? others.map((u) => ({ id: `drive-${u.id}`, label: `Hand the wheel to ${u.display_name || u.email}`, run: () => setPair(u.id) })) : []),
      { id: 'wall', label: 'Class wall: see every student', hidden: !(isOwner && currentWorkspace?.is_classroom), run: () => navigate(`/editor/${workspaceId}/wall`) },
      { id: 'view-tasks', label: 'Open the task board', run: () => setView('tasks') },
      { id: 'view-wiki', label: 'Open the wiki', run: () => setView('wiki') },
      { id: 'view-events', label: 'Open events', run: () => setView('events') },
      { id: 'assets', label: 'Shared files', run: () => openPanel('assets') },
      { id: 'view-code', label: 'Back to the code', hidden: view === 'code', run: () => setView('code') },
      { id: 'task-line', label: 'Make a task from this line', hidden: !activeFile || !canEdit, run: () => runEditorAction('devsync.task') },
      { id: 'flashcard', label: 'Make a flashcard from selection', hidden: !activeFile, run: () => runEditorAction('devsync.flashcard') },
      { id: 'view-insights', label: 'Open insights', hidden: !isOwner, run: () => setView('insights') },
      { id: 'review', label: 'Review flashcards', run: () => navigate('/review') },
      { id: 'huddle', label: 'Start or join a huddle', run: () => joinCall() },
      { id: 'alerts', label: 'Slack or Discord alerts', hidden: !isOwner, run: () => setModal('alerts') },
      { id: 'github', label: 'Send to GitHub', run: () => setModal('github') },
      { id: 'graph', label: 'Show the call graph', hidden: !activeFile, run: () => setRightPane({ type: 'graph' }) },
      { id: 'interview', label: currentWorkspace?.interview_started_at ? 'End interview' : 'Start interview mode', hidden: !isOwner, run: () => setInterview(!currentWorkspace?.interview_started_at) },
      { id: 'settings', label: 'Editor settings', shortcut: [MOD, ','], run: () => setModal('settings') },
      { id: 'vim', label: vim ? 'Turn off Vim keys' : 'Turn on Vim keys', run: () => useSettingsStore.getState().update({ vim: !vim }) },
      { id: 'wrap', label: wrap ? 'Turn off word wrap' : 'Turn on word wrap', run: () => useSettingsStore.getState().update({ wordWrap: !wrap }) },
      { id: 'theme-light', label: 'Theme: light', run: () => useThemeStore.getState().setTheme('light') },
      { id: 'theme-dark', label: 'Theme: dark', run: () => useThemeStore.getState().setTheme('dark') },
      { id: 'theme-system', label: 'Theme: match system', run: () => useThemeStore.getState().setTheme('system') },
      { id: 'shortcuts', label: 'Keyboard shortcuts', shortcut: ['?'], run: () => setModal('shortcuts') },
      { id: 'tour', label: 'Show the tour again', run: () => setModal('tour') },
    ];
  }, [activeFile, activeFileId, files, readOnly, runnable, rightPane, zen, sidebarOpen, canEdit, isOwner, driver, rotation, presence, following, user?.id, currentWorkspace, modal, inkMode, authorship, view]);

  // Keyboard shortcuts that work everywhere, including inside the editor
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      let action = null;
      if (mod && e.shiftKey && key === 'p') action = () => setPalette('commands');
      else if (mod && !e.shiftKey && key === 'p') action = () => setPalette('files');
      else if (mod && e.shiftKey && key === 'f') action = () => openPanel('search');
      else if (mod && !e.shiftKey && key === 'b') action = () => setSidebarOpen((o) => !o);
      else if (mod && key === '\\') action = () => activeFileId && setRightPane(useEditorStore.getState().rightPane?.type === 'split' ? null : { type: 'split', fileId: activeFileId });
      else if (mod && key === ',') action = () => setModal('settings');
      else if (e.key === '?' && !mod && !isTyping(e.target)) action = () => setModal('shortcuts');
      else if (e.key === 'Escape' && useEditorStore.getState().inkMode) action = () => toggleInk(false);
      if (!action) return;
      e.preventDefault();
      e.stopPropagation();
      action();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [activeFileId]);

  if (loading) return <PageLoader label="Opening workspace…" />;
  if (currentWorkspace?.id !== workspaceId) return <WorkspaceUnavailable />;

  const filePath = activeFile?.path?.replace(/^\//, '') || activeFile?.name;
  const splitFileId = rightPane?.type === 'split' && openFiles.some((f) => f.id === rightPane.fileId) ? rightPane.fileId : null;
  const previewFile = rightPane?.type === 'preview' ? previewTarget(activeFile, files, rightPane.fileId) : null;
  const showPreview = !!previewFile;
  const showGraph = rightPane?.type === 'graph' && graphable(activeFile);
  const followed = following && presence.find((u) => u.id === following);

  const moreItems = [
    { label: 'File history', icon: GoHistory, hidden: !activeFile, onSelect: () => setModal('history') },
    { label: 'Replay this file', icon: GoVideo, hidden: !activeFile, onSelect: () => setModal('replay') },
    { label: 'Save a checkpoint…', icon: GoBookmark, hidden: !canEdit, onSelect: () => setModal('checkpoint') },
    'divider',
    { label: 'Start pair mode', icon: GoPeople, hidden: !canEdit || !!driver, onSelect: () => setPair(user.id) },
    { label: 'Mob mode (10 min turns)', icon: GoPeople, hidden: !canEdit || !!driver, onSelect: () => startMob(10) },
    { label: 'Take the wheel', icon: GoPeople, hidden: !canEdit || !driver || driver === user.id, onSelect: () => setPair(user.id) },
    { label: 'End pair mode', icon: GoPeople, hidden: !driver || (driver !== user.id && !isOwner), onSelect: () => setPair(null) },
    { label: currentWorkspace.interview_started_at ? 'End interview' : 'Interview mode', icon: GoStopwatch, hidden: !isOwner, onSelect: () => setInterview(!currentWorkspace.interview_started_at) },
    { label: 'Zen mode', icon: GoScreenFull, onSelect: () => toggleZen(true) },
    'divider',
    { label: 'Download as zip', icon: GoDownload, onSelect: () => downloadZip(currentWorkspace.name) },
    { label: 'Duplicate workspace', icon: GoDuplicate, onSelect: duplicate },
    { label: 'Fork to try an idea', icon: GoRepoForked, onSelect: fork },
    { label: 'GitHub', icon: VscGithub, onSelect: () => setModal('github') },
    { label: 'Slack or Discord alerts', icon: GoBell, hidden: !isOwner, onSelect: () => setModal('alerts') },
    { label: 'Editor settings', icon: GoGear, onSelect: () => setModal('settings') },
  ];

  return (
    <div className="flex h-screen flex-col bg-canvas">
      {/* Top bar */}
      {!zen && (
        <header className="flex h-12 shrink-0 items-center gap-1 border-b border-line bg-canvas px-2 sm:gap-2 sm:px-3">
          <Link to="/dashboard" className="icon-btn" aria-label="Back to workspaces" title="Back to workspaces">
            <GoArrowLeft size={16} />
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen((o) => !o)}
            className="icon-btn"
            aria-pressed={sidebarOpen}
            aria-label={sidebarOpen ? 'Hide side panel' : 'Show side panel'}
            title={`${sidebarOpen ? 'Hide' : 'Show'} side panel (${MOD}+B)`}
          >
            {sidebarOpen ? <GoSidebarExpand size={16} /> : <GoSidebarCollapse size={16} />}
          </button>
          <div className="mx-1 hidden h-5 w-px bg-line sm:block" />

          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-body-sm">
            <span className="truncate font-semibold text-ink">{currentWorkspace.name}</span>
            {filePath && (
              <span className="hidden min-w-0 items-center gap-1.5 md:flex">
                <span className="text-ink-subtle" aria-hidden="true">/</span>
                <span className="truncate text-ink-muted">{filePath}</span>
              </span>
            )}
          </nav>
          <div role="tablist" aria-label="Workspace view" className="ml-2 hidden shrink-0 items-center rounded-md border border-line-strong bg-canvas-subtle p-[2px] md:flex">
            {views.map((v) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={view === v.id}
                onClick={() => setView(v.id)}
                className={`h-7 rounded-[4px] px-2.5 text-label-md transition-colors ${view === v.id ? 'bg-canvas text-ink shadow-[0_0_0_1px_rgb(var(--line-strong))]' : 'text-ink-muted hover:text-ink'}`}
              >
                {v.label}
              </button>
            ))}
          </div>
          {!canEdit && (
            <span className="badge ml-1 shrink-0" title="You can't edit here, but you can suggest changes: select code, right-click, Suggest a change">
              <GoEye size={12} aria-hidden="true" /> View only
            </span>
          )}
          {driver && (
            <span className="badge ml-1 hidden shrink-0 border-brand/25 bg-brand-soft text-brand-fg sm:inline-flex" title="Pair mode: one person types, everyone watches">
              <GoPeople size={12} aria-hidden="true" /> {driver === user.id ? "You're driving" : `${nameOf(driver)} is driving`}
              {rotation && <span className="text-brand-fg/80">· next in <Countdown to={rotation.nextAt} /></span>}
            </span>
          )}
          {spectators > 0 && (
            <span className="badge ml-1 hidden shrink-0 sm:inline-flex" title="People watching through the public link">
              <GoEye size={12} aria-hidden="true" /> {spectators} watching
            </span>
          )}
          {frozen && !isOwner && (
            <span className="badge ml-1 shrink-0 border-[#D29922]/40 bg-[#FFF8E5] text-[#7D4E00] dark:bg-[#2B2111] dark:text-[#E3B341]">Paused by your teacher</span>
          )}
          {currentWorkspace.interview_started_at && (
            <InterviewBar workspaceId={workspaceId} startedAt={currentWorkspace.interview_started_at} isOwner={isOwner} onEnd={() => setInterview(false)} />
          )}

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            <SaveStatus connection={connection} status={activeStatus} readOnly={readOnly} />
            <Presence users={presence} currentUserId={user?.id} following={following} onFollow={follow} />
            {presence.length > 0 && <div className="mx-1 hidden h-5 w-px bg-line sm:block" />}
            <button
              type="button"
              data-tour="palette"
              onClick={() => setPalette('commands')}
              className="icon-btn hidden sm:inline-flex"
              aria-label="Command palette"
              title={`Command palette (${MOD}+Shift+P)`}
            >
              <GoCommandPalette size={16} />
            </button>
            {currentWorkspace.classroom_id && <ClassroomBar workspace={currentWorkspace} refresh={raceTick} />}
            {isOwner && currentWorkspace.is_classroom && (
              <Link to={`/editor/${workspaceId}/wall`} className="btn btn-sm btn-secondary hidden md:inline-flex" title="See every student's copy live">
                <GoMortarBoard size={14} /> Class wall
              </Link>
            )}
            <button
              type="button"
              onClick={() => (call ? setCall(null) : joinCall())}
              aria-pressed={!!call}
              className={`icon-btn hidden sm:inline-flex ${call ? 'bg-brand-soft text-brand-fg' : ''}`}
              aria-label={call ? 'Leave huddle' : 'Start or join a huddle'}
              title={call ? 'Leave huddle' : 'Huddle: talk, show your camera or share your screen'}
            >
              <GoDeviceCameraVideo size={16} />
            </button>
            <FocusButton workspaceId={workspaceId} />
            <NotificationBell className="hidden sm:block" />
            <ThemeMenu className="hidden md:block" />
            <DropdownMenu label="More" items={moreItems} />
            {isOwner && (
              <Button variant="secondary" size="sm" data-tour="share" onClick={() => setModal('share')} aria-label="Share workspace">
                <GoPersonAdd size={16} /> <span className="hidden sm:inline">Share</span>
              </Button>
            )}
            <Button
              size="sm"
              data-tour="run"
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
      )}

      <div className="relative flex min-h-0 flex-1">
        {sidebarOpen && !zen && view === 'code' && (
          <>
            {/* Tap outside to close on phones */}
            <button
              type="button"
              aria-label="Close side panel"
              onClick={() => setSidebarOpen(false)}
              className="absolute inset-0 z-20 animate-fade-in bg-[#1F2328]/30 dark:bg-black/50 md:hidden"
            />
            <aside
              data-tour="files"
              style={{ '--sidebar-w': `${sidebar.size}px` }}
              className="absolute inset-y-0 left-0 z-30 flex w-80 max-w-[85vw] flex-col border-r border-line bg-canvas-subtle shadow-overlay md:relative md:z-auto md:w-[var(--sidebar-w)] md:max-w-none md:shrink-0 md:shadow-none"
            >
              <div role="tablist" aria-label="Side panel" className="flex h-10 shrink-0 items-center gap-0.5 border-b border-line px-1.5">
                {PANELS.map((p) => {
                  const active = sidebarPanel === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      aria-label={p.label}
                      title={p.label}
                      onClick={() => setSidebarPanel(p.id)}
                      className={`relative flex h-8 flex-1 items-center justify-center rounded-md transition-colors ${active ? 'bg-canvas text-ink shadow-[0_0_0_1px_rgb(var(--line))]' : 'text-ink-muted hover:bg-canvas-muted hover:text-ink'}`}
                    >
                      <p.icon size={16} />
                      {p.id === 'chat' && unreadChat > 0 && (
                        <span className="absolute right-1 top-1 min-w-[16px] rounded-full bg-brand px-1 text-[10px] font-semibold leading-4 text-white">{unreadChat > 9 ? '9+' : unreadChat}</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div role="tabpanel" className="min-h-0 flex-1">
                {sidebarPanel === 'files' && <FileTree workspaceId={workspaceId} workspaceName={currentWorkspace.name} userId={user?.id} readOnly={readOnly} />}
                {sidebarPanel === 'search' && <SearchPanel readOnly={readOnly} />}
                {sidebarPanel === 'comments' && <CommentsPanel userId={user?.id} people={people} draft={commentDraft} onDraftDone={() => setCommentDraft(null)} canEdit={canEdit} />}
                {sidebarPanel === 'chat' && <ChatPanel workspaceId={workspaceId} userId={user?.id} people={people} canEdit={canEdit} />}
                {sidebarPanel === 'activity' && <ActivityPanel workspaceId={workspaceId} people={people} />}
                {sidebarPanel === 'assets' && <Suspense fallback={<ViewLoading />}><AssetsPanel workspaceId={workspaceId} readOnly={!canEdit} /></Suspense>}
              </div>
              <div {...sidebar.handleProps} aria-label="Resize side panel" className="resize-handle-x hidden md:block" />
            </aside>
          </>
        )}

        {view !== 'code' && (
          <main className="min-w-0 flex-1">
            <Suspense fallback={<ViewLoading />}>
              {view === 'tasks' && (
                <TasksView
                  workspaceId={workspaceId}
                  userId={user?.id}
                  people={people}
                  readOnly={!canEdit}
                  draft={taskDraft}
                  onDraftDone={() => setTaskDraft(null)}
                  onOpenCode={(task) => {
                    setView('code');
                    const index = socketService.collab?.get(task.file_id)?.resolveAnchor(task.anchor);
                    const text = index != null ? useEditorStore.getState().contentOf(task.file_id) : '';
                    const line = index != null ? text.slice(0, index).split('\n').length : task.line || 1;
                    useEditorStore.getState().revealAt(task.file_id, { line });
                  }}
                />
              )}
              {view === 'insights' && isOwner && <InsightsView workspaceId={workspaceId} />}
              {view === 'events' && (
                <EventsView workspaceId={workspaceId} userId={user?.id} people={people} readOnly={!canEdit} onJoin={() => setView('code')} />
              )}
              {view === 'wiki' && (
                <WikiView
                  workspaceId={workspaceId}
                  userId={user?.id}
                  readOnly={!canEdit}
                  onEdit={(page) => {
                    setView('code');
                    useEditorStore.getState().openFile(page);
                    setRightPane({ type: 'preview' });
                  }}
                />
              )}
            </Suspense>
          </main>
        )}
        <main className={`min-w-0 flex-1 flex-col ${view === 'code' ? 'flex' : 'hidden'}`}>
          {!zen && currentWorkspace.fork_of && (
            <div className="flex h-9 shrink-0 items-center gap-2 border-b border-line bg-canvas-subtle px-3 text-body-sm text-ink-muted">
              <GoRepoForked size={14} aria-hidden="true" />
              <span className="truncate">This is a fork. Try ideas here, then bring them back.</span>
              <Button size="sm" variant="secondary" className="ml-auto !h-7" onClick={() => setModal('merge')}>Review and merge</Button>
            </div>
          )}
          {!zen && <EditorTabs />}
          {followed && (
            <div role="status" className="flex h-8 shrink-0 items-center gap-2 border-b border-brand/25 bg-brand-soft px-3 text-label-md text-brand-fg">
              <Avatar name={followed.display_name || followed.email} id={followed.id} src={followed.avatar_url} size={18} />
              Following {followed.display_name || followed.email}
              <button type="button" onClick={() => follow(null)} className="ml-auto text-label-sm underline-offset-2 hover:underline">Stop</button>
            </div>
          )}
          <div className="flex min-h-0 flex-1">
            <div className="min-w-0 flex-1">
              {activeFileId && languageForFile(activeFile?.name) === 'whiteboard' ? (
                <Suspense fallback={<ViewLoading />}>
                  <WhiteboardEditor key={activeFileId} fileId={activeFileId} readOnly={readOnly} />
                </Suspense>
              ) : activeFileId ? (
                <CodeEditor fileId={activeFileId} readOnly={readOnly} highlightPastes={!!(currentWorkspace.interview_started_at || currentWorkspace.classroom_id)} />
              ) : <EmptyState />}
            </div>
            {(splitFileId || showPreview || showGraph) && (
              <div className="relative hidden shrink-0 border-l border-line md:block" style={{ width: split.size, maxWidth: '60%' }}>
                <div {...split.handleProps} aria-label="Resize split" className="resize-handle-x !-left-[3px] !right-auto" />
                {showGraph ? (
                  <PreviewPane key={`graph-${activeFile.id}`} file={activeFile} graph onClose={() => setRightPane(null)} />
                ) : showPreview ? (
                  <PreviewPane file={previewFile} onClose={() => setRightPane(null)} />
                ) : (
                  <SplitPane fileId={splitFileId} readOnly={readOnly} onClose={() => setRightPane(null)} />
                )}
              </div>
            )}
          </div>
          {!zen && <OutputPanel workspaceId={workspaceId} readOnly={readOnly} />}
        </main>

        {zen && (
          <button
            type="button"
            onClick={() => toggleZen(false)}
            className="btn btn-sm btn-secondary absolute right-4 top-3 z-20 bg-canvas shadow-overlay"
          >
            <GoX size={14} /> Leave zen
          </button>
        )}
      </div>

      <InviteMemberModal
        // Closes by itself if you hand ownership to someone else
        isOpen={modal === 'share' && isOwner}
        onClose={() => setModal(null)}
        onInvite={(email, role) => inviteMember(workspaceId, email, role)}
        members={members}
        currentUserId={user?.id}
        workspaceId={workspaceId}
        workspace={currentWorkspace}
      />
      <SettingsModal isOpen={modal === 'settings'} onClose={() => setModal(null)} />
      <ShortcutsModal isOpen={modal === 'shortcuts'} onClose={() => setModal(null)} />
      <CheckpointModal isOpen={modal === 'checkpoint'} onClose={() => setModal(null)} workspaceId={workspaceId} />
      {activeFile && <HistoryModal isOpen={modal === 'history'} onClose={() => setModal(null)} file={activeFile} people={people} readOnly={readOnly} />}
      {activeFile && <ReplayModal isOpen={modal === 'replay'} onClose={() => setModal(null)} file={activeFile} people={people} publicToken={currentWorkspace.public_token} />}
      <CodeImageModal request={imageRequest} onClose={() => setImageRequest(null)} />
      <ReactionPicker request={reacting} userId={user?.id} workspaceId={workspaceId} onClose={() => setReacting(null)} />
      <SuggestModal request={suggesting} userId={user?.id} workspaceId={workspaceId} onClose={() => setSuggesting(null)} />
      {currentWorkspace.fork_of && <ForkMergeModal isOpen={modal === 'merge'} onClose={() => setModal(null)} workspaceId={workspaceId} />}
      {palette && <CommandPalette mode={palette} onClose={() => setPalette(null)} commands={commands} />}
      {modal === 'tour' && <Tour onDone={() => setModal(null)} />}
      <FlashcardModal request={cardDraft} userId={user?.id} onClose={() => setCardDraft(null)} />
      <CheckinCard workspaceId={workspaceId} userId={user?.id} memberCount={members.length} />
      <Announcer userId={user?.id} />
      <Suspense fallback={null}>
        {call && <CallPanel call={call} onLeave={() => setCall(null)} />}
        {isOwner && modal === 'alerts' && <AlertsModal isOpen onClose={() => setModal(null)} workspaceId={workspaceId} />}
        {modal === 'github' && <GitHubModal isOpen onClose={() => setModal(null)} workspace={currentWorkspace} />}
      </Suspense>
    </div>
  );
}
