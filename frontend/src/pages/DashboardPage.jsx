import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoColumns, GoPlus, GoRepo, GoRows, GoSearch, GoSync, GoX } from 'react-icons/go';
import Navbar from '../components/layout/Navbar';
import WorkspaceCard, { WorkspaceRow } from '../components/workspace/WorkspaceCard';
import CreateWorkspaceModal from '../components/workspace/CreateWorkspaceModal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import ToggleGroup from '../components/ui/ToggleGroup';
import useAuthStore from '../store/authStore';
import useWorkspaceStore from '../store/workspaceStore';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'owned', label: 'Owned by you' },
  { id: 'shared', label: 'Shared with you' },
];

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
  const { user, profile } = useAuthStore();
  const { workspaces, loading, error, fetchWorkspaces, createWorkspace, deleteWorkspace } = useWorkspaceStore();
  const [showCreate, setShowCreate] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState(readView);

  useEffect(() => {
    if (user) fetchWorkspaces(user.id);
  }, [user, fetchWorkspaces]);

  const changeView = (next) => {
    setView(next);
    try { localStorage.setItem(VIEW_KEY, next); } catch { /* storage unavailable */ }
  };

  const isOwner = (w) => w.owner_id === user?.id;
  const counts = useMemo(() => {
    const owned = workspaces.filter((w) => w.owner_id === user?.id).length;
    return { all: workspaces.length, owned, shared: workspaces.length - owned };
  }, [workspaces, user]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workspaces.filter((w) => {
      const owned = w.owner_id === user?.id;
      if (filter === 'owned' && !owned) return false;
      if (filter === 'shared' && owned) return false;
      return !q || w.name.toLowerCase().includes(q) || w.description?.toLowerCase().includes(q);
    });
  }, [workspaces, search, filter, user]);

  const handleCreate = async (name, description, language) => {
    const result = await createWorkspace(name, description, language, user.id);
    if (!result.error) navigate(`/editor/${result.data.id}`);
    return result;
  };

  const confirmDelete = async () => {
    setDeleting(true);
    await deleteWorkspace(pendingDelete.id);
    setDeleting(false);
    setPendingDelete(null);
  };

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
          <Button onClick={() => setShowCreate(true)} className="self-start sm:self-auto">
            <GoPlus size={16} /> New workspace
          </Button>
        </div>

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
                  <WorkspaceCard key={w.id} workspace={w} isOwner={isOwner(w)} onDelete={setPendingDelete} />
                ))}
              </div>
            ) : (
              <ul className="card animate-fade-in divide-y divide-line overflow-hidden">
                {visible.map((w) => (
                  <WorkspaceRow key={w.id} workspace={w} isOwner={isOwner(w)} onDelete={setPendingDelete} />
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

      <ConfirmDialog
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Delete workspace?"
        confirmLabel="Delete workspace"
      >
        <p>
          <span className="font-semibold text-ink">{pendingDelete?.name}</span> and all of its files will be permanently
          deleted for everyone. This can't be undone.
        </p>
      </ConfirmDialog>
    </div>
  );
}
