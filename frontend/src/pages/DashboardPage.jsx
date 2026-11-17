import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { GoArchive, GoColumns, GoDuplicate, GoPencil, GoPin, GoPlus, GoRepo, GoRows, GoSearch, GoSignOut, GoSync, GoTrash, GoX, GoZap, GoCalendar, GoStack } from 'react-icons/go';
import Navbar from '../components/layout/Navbar';
import WorkspaceCard, { WorkspaceRow } from '../components/workspace/WorkspaceCard';
import CreateWorkspaceModal from '../components/workspace/CreateWorkspaceModal';
import ImportRepoModal from '../components/workspace/ImportRepoModal';
import SinceLastVisit from '../components/workspace/SinceLastVisit';
import { VscGithub } from 'react-icons/vsc';
import RenameWorkspaceModal from '../components/workspace/RenameWorkspaceModal';
import LangDot from '../components/ui/LangDot';
import { todaysChallenge, challengeWorkspace } from '../lib/templates';
import { api } from '../lib/api';
import { toast } from '../store/toastStore';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import ToggleGroup from '../components/ui/ToggleGroup';
import useAuthStore from '../store/authStore';
import useWorkspaceStore from '../store/workspaceStore';
import { supabase } from '../lib/supabase';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'owned', label: 'Owned by you' },
  { id: 'shared', label: 'Shared with you' },
  { id: 'archived', label: 'Archived' },
];

// Today's challenge, one click from a workspace with tests
function DailyChallenge({ onStart }) {
  const c = todaysChallenge();
  const [busy, setBusy] = useState(null);
  const start = async (language) => {
    setBusy(language);
    await onStart(c, language);
    setBusy(null);
  };
  return (
    <section aria-label="Daily challenge" className="card mt-8 flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-fg">
        <GoZap size={18} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-label-sm text-ink-muted">Daily challenge · {c.difficulty}</p>
        <h2 className="mt-1 text-label-lg font-semibold text-ink">{c.title}</h2>
        <p className="mt-1 line-clamp-2 text-body-sm text-ink-muted">{c.description}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        {['python', 'javascript'].map((lang) => (
          <Button key={lang} size="sm" variant="secondary" loading={busy === lang} disabled={!!busy} onClick={() => start(lang)}>
            {busy !== lang && <LangDot language={lang} />} {lang === 'python' ? 'Python' : 'JavaScript'}
          </Button>
        ))}
      </div>
    </section>
  );
}

// Flashcards due and the next few events across your workspaces. Hidden when there's neither.
function UpNext({ userId }) {
  const [due, setDue] = useState(0);
  const [events, setEvents] = useState([]);
  useEffect(() => {
    if (!userId) return;
    const now = new Date().toISOString();
    supabase.from('flashcards').select('id', { count: 'exact', head: true }).eq('user_id', userId).lte('due_at', now)
      .then(({ count }) => setDue(count || 0));
    supabase.from('events').select('id, title, starts_at, workspace_id, workspaces(name)').gte('ends_at', now).order('starts_at').limit(3)
      .then(({ data }) => setEvents(data || []));
  }, [userId]);
  if (!due && !events.length) return null;
  const when = (iso) => new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return (
    <div className="mt-3 grid gap-3 md:grid-cols-[1fr_2fr]">
      {due > 0 && (
        <Link to="/review" className="card flex items-center gap-3 p-4 hover:border-line-strong">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-fg"><GoStack size={18} aria-hidden="true" /></span>
          <span>
            <span className="block text-label-lg font-semibold text-ink">{due} {due === 1 ? 'card' : 'cards'} to review</span>
            <span className="text-body-sm text-ink-muted">A few minutes keeps them fresh</span>
          </span>
        </Link>
      )}
      {events.length > 0 && (
        <section aria-label="Upcoming events" className={`card p-4 ${due ? '' : 'md:col-span-2'}`}>
          <h2 className="flex items-center gap-2 text-label-md text-ink-muted"><GoCalendar size={14} aria-hidden="true" /> Coming up</h2>
          <ul className="mt-2 space-y-1.5">
            {events.map((e) => (
              <li key={e.id}>
                <Link to={`/editor/${e.workspace_id}?view=events`} className="flex items-baseline justify-between gap-3 text-body-sm hover:underline">
                  <span className="truncate text-ink">{e.title} <span className="text-ink-subtle">· {e.workspaces?.name}</span></span>
                  <span className="shrink-0 text-ink-muted">{when(e.starts_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

const VIEW_KEY = 'devsync:dashboard-view';
function readView() {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

function SkeletonCard() {
  return (
    <div className="card p-4" aria-hidden="true">
      <div className="skeleton h-3 w-24" />
      <div className="skeleton mt-4 h-4 w-40" />
      <div className="skeleton mt-3 h-3 w-full" />
      <div className="skeleton mt-2 h-3 w-2/3" />
      <div className="mt-5 border-t border-line pt-3">
        <div className="skeleton h-3 w-32" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuthStore();
  const { workspaces, loading, error, fetchWorkspaces, createWorkspace, deleteWorkspace, leaveWorkspace, duplicateWorkspace, setPref } = useWorkspaceStore();
  const [showCreate, setShowCreate] = useState(false);
  // ?import=github reopens the import dialog after connecting GitHub
  const [showImport, setShowImport] = useState(() => new URLSearchParams(location.search).get('import') === 'github');
  const [renaming, setRenaming] = useState(null);
  const [pending, setPending] = useState(null); // { type: 'delete' | 'leave', workspace }
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(location.state?.notice || '');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState(readView);

  useEffect(() => {
    if (user) fetchWorkspaces(user.id);
  }, [user, fetchWorkspaces]);

  // Back to where sign-in started (an invite link, a shared file), once
  useEffect(() => {
    let to = null;
    try {
      to = sessionStorage.getItem('devsync:return-to');
      sessionStorage.removeItem('devsync:return-to');
    } catch { /* storage unavailable */ }
    if (to && to !== '/dashboard') navigate(to, { replace: true });
  }, [navigate]);

  // Email invites sent before this person had an account turn into memberships now
  useEffect(() => {
    if (!user) return;
    try {
      if (sessionStorage.getItem('devsync:claimed') === user.id) return;
      sessionStorage.setItem('devsync:claimed', user.id);
    } catch { /* storage unavailable */ }
    api('/api/invites/claim', { method: 'POST' })
      .then(({ joined }) => {
        if (!joined?.length) return;
        fetchWorkspaces(user.id);
        toast(`You joined ${joined.length} ${joined.length === 1 ? 'workspace' : 'workspaces'} you were invited to`, { tone: 'success' });
      })
      .catch(() => {});
  }, [user, fetchWorkspaces]);

  // A notice passed in navigation state is shown once, not again on refresh
  useEffect(() => {
    if (location.state?.notice) window.history.replaceState({}, '');
  }, [location.state]);

  const changeView = (next) => {
    setView(next);
    try { localStorage.setItem(VIEW_KEY, next); } catch { /* storage unavailable */ }
  };

  const isOwner = (w) => w.owner_id === user?.id;
  const counts = useMemo(() => {
    const active = workspaces.filter((w) => !w.archived);
    const owned = active.filter((w) => w.owner_id === user?.id).length;
    return { all: active.length, owned, shared: active.length - owned, archived: workspaces.length - active.length };
  }, [workspaces, user]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workspaces
      .filter((w) => {
        const owned = w.owner_id === user?.id;
        if ((filter === 'archived') !== !!w.archived) return false;
        if (filter === 'owned' && !owned) return false;
        if (filter === 'shared' && owned) return false;
        return !q || w.name.toLowerCase().includes(q) || w.description?.toLowerCase().includes(q);
      })
      .sort((a, b) => b.pinned - a.pinned); // pinned first, otherwise most recently updated
  }, [workspaces, search, filter, user]);

  const handleCreate = async (name, description, language, template) => {
    const result = await createWorkspace(name, description, language, template);
    if (!result.error) navigate(`/editor/${result.data.id}`);
    return result;
  };

  const confirmPending = async () => {
    setBusy(true);
    if (pending.type === 'delete') await deleteWorkspace(pending.workspace.id);
    else {
      const { error: err } = await leaveWorkspace(pending.workspace.id);
      if (err) setNotice(err.message);
    }
    setBusy(false);
    setPending(null);
  };

  const startChallenge = async (challenge, language) => {
    const t = challengeWorkspace(challenge, language);
    const result = await createWorkspace(t.name, t.description, t.default_language, t);
    if (result.error) toast(result.error.message, { tone: 'error' });
    else navigate(`/editor/${result.data.id}`);
  };

  const duplicate = async (w) => {
    const { data, error: err } = await duplicateWorkspace(w.id);
    if (err) toast(err.message, { tone: 'error' });
    else toast(`Made a copy of ${w.name}`, { tone: 'success', action: { label: 'Open', onClick: () => navigate(`/editor/${data.id}`) } });
  };

  const actionsFor = (w) => [
    { label: 'Rename', icon: GoPencil, hidden: !isOwner(w), onSelect: () => setRenaming(w) },
    { label: 'Duplicate', icon: GoDuplicate, onSelect: () => duplicate(w) },
    { label: w.pinned ? 'Unpin' : 'Pin to top', icon: GoPin, onSelect: () => setPref(w.id, user.id, { pinned: !w.pinned }) },
    { label: w.archived ? 'Move out of archive' : 'Archive', icon: GoArchive, onSelect: () => setPref(w.id, user.id, { archived: !w.archived }) },
    'divider',
    { label: 'Leave workspace', icon: GoSignOut, danger: true, hidden: isOwner(w), onSelect: () => setPending({ type: 'leave', workspace: w }) },
    { label: 'Delete workspace', icon: GoTrash, danger: true, hidden: !isOwner(w), onSelect: () => setPending({ type: 'delete', workspace: w }) },
  ];

  const firstName = profile?.display_name?.split(' ')[0];
  const firstLoad = loading && workspaces.length === 0;
  const filterOptions = FILTERS.map((f) => ({
    ...f,
    label: (
      <>
        {f.label}
        <span className="tabular-nums text-ink-subtle">{counts[f.id]}</span>
      </>
    ),
  }));

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-headline-md text-ink">Workspaces</h1>
            <p className="mt-1.5 text-body-md text-ink-muted">
              {firstName ? `Welcome back, ${firstName}. ` : ''}Pick up where you left off.
            </p>
          </div>
          <div className="flex gap-2 self-start sm:self-auto">
            <Button variant="secondary" onClick={() => { navigate('/dashboard?import=github', { replace: true }); setShowImport(true); }}>
              <VscGithub size={16} aria-hidden="true" /> Import from GitHub
            </Button>
            <Button onClick={() => setShowCreate(true)}>
              <GoPlus size={16} /> New workspace
            </Button>
          </div>
        </div>

        <DailyChallenge onStart={startChallenge} />
        <UpNext userId={user?.id} />
        <SinceLastVisit workspaces={workspaces} />

        {/* Toolbar: one row on desktop; on phones the filters drop to their own full-width row */}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1 lg:max-w-sm">
            <GoSearch size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find a workspace…"
              aria-label="Find a workspace"
              className="input pl-9"
            />
          </div>
          <div className="no-scrollbar order-last w-full overflow-x-auto lg:order-none lg:w-auto">
            <ToggleGroup label="Filter workspaces" options={filterOptions} value={filter} onChange={setFilter} />
          </div>
          <div className="flex items-center gap-2 lg:ml-auto">
              <ToggleGroup
                label="Layout"
                value={view}
                onChange={changeView}
                options={[
                  { id: 'grid', icon: <GoColumns size={16} />, ariaLabel: 'Grid view' },
                  { id: 'list', icon: <GoRows size={16} />, ariaLabel: 'List view' },
                ]}
              />
              <button
                type="button"
                onClick={() => fetchWorkspaces(user.id)}
                disabled={loading}
                aria-label="Refresh workspaces"
                title="Refresh"
                className="icon-btn h-10 w-10 border border-line-strong"
              >
                <GoSync size={16} className={loading ? 'animate-spin' : ''} />
              </button>
          </div>
        </div>

        {/* Content */}
        <div className="mt-6">
          {notice && (
            <Alert tone="info" className="mb-6" onDismiss={() => setNotice('')}>{notice}</Alert>
          )}
          {error && !loading && (
            <Alert className="mb-6">
              Something went wrong: {error}{' '}
              <button type="button" onClick={() => fetchWorkspaces(user.id)} className="font-medium underline underline-offset-2">
                Try again
              </button>
            </Alert>
          )}

          {firstLoad ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : visible.length > 0 ? (
            view === 'grid' ? (
              <div className="grid animate-fade-in gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visible.map((w) => (
                  <WorkspaceCard key={w.id} workspace={w} isOwner={isOwner(w)} actions={actionsFor(w)} />
                ))}
              </div>
            ) : (
              <ul className="card animate-fade-in divide-y divide-line">
                {visible.map((w) => (
                  <WorkspaceRow key={w.id} workspace={w} isOwner={isOwner(w)} actions={actionsFor(w)} />
                ))}
              </ul>
            )
          ) : workspaces.length > 0 ? (
            <div className="card flex flex-col items-center px-6 py-16 text-center">
              <GoSearch size={24} className="text-ink-subtle" aria-hidden="true" />
              <h2 className="mt-4 text-headline-sm font-semibold text-ink">No matching workspaces</h2>
              <p className="mt-2 text-body-sm text-ink-muted">
                {search ? `Nothing matches “${search.trim()}”` : 'Nothing here yet'}
                {filter !== 'all' && ` in ${FILTERS.find((f) => f.id === filter).label.toLowerCase()}`}.
              </p>
              <Button variant="secondary" className="mt-6" onClick={() => { setSearch(''); setFilter('all'); }}>
                <GoX size={16} /> Clear filters
              </Button>
            </div>
          ) : (
            <div className="card flex flex-col items-center px-6 py-20 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand-fg">
                <GoRepo size={22} aria-hidden="true" />
              </span>
              <h2 className="mt-5 text-headline-sm font-semibold text-ink">Create your first workspace</h2>
              <p className="mt-2 max-w-sm text-body-sm text-ink-muted">
                A workspace holds your files and collaborators. Pick a language and you can run code in seconds.
              </p>
              <Button className="mt-6" onClick={() => setShowCreate(true)}>
                <GoPlus size={16} /> New workspace
              </Button>
            </div>
          )}
        </div>
      </main>

      <CreateWorkspaceModal isOpen={showCreate} onClose={() => setShowCreate(false)} onCreate={handleCreate} />
      <ImportRepoModal isOpen={showImport} onClose={() => { setShowImport(false); navigate('/dashboard', { replace: true }); }} />
      <RenameWorkspaceModal workspace={renaming} onClose={() => setRenaming(null)} />

      <ConfirmDialog
        isOpen={!!pending}
        onClose={() => setPending(null)}
        onConfirm={confirmPending}
        loading={busy}
        title={pending?.type === 'leave' ? 'Leave workspace?' : 'Delete workspace?'}
        confirmLabel={pending?.type === 'leave' ? 'Leave workspace' : 'Delete workspace'}
      >
        {pending?.type === 'leave' ? (
          <p>
            You'll lose access to <span className="font-semibold text-ink">{pending.workspace.name}</span>. The owner can invite
            you again later.
          </p>
        ) : (
          <p>
            <span className="font-semibold text-ink">{pending?.workspace.name}</span> and all of its files will be permanently
            deleted for everyone. This can't be undone.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
