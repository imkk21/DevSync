import { Link } from 'react-router-dom';
import { GoMortarBoard, GoPeople, GoPin } from 'react-icons/go';
import LangDot from '../ui/LangDot';
import DropdownMenu from '../ui/DropdownMenu';
import { getLanguage } from '../../lib/languages';

export function timeAgo(dateStr) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// Owner / Shared, plus pinned and classroom markers
function Badges({ workspace, isOwner }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {workspace.pinned && <GoPin size={14} className="text-ink-muted" aria-label="Pinned" />}
      {workspace.is_classroom && <span className="badge"><GoMortarBoard size={12} aria-hidden="true" /> Classroom</span>}
      <span className="badge">{isOwner ? 'Owner' : 'Shared'}</span>
    </span>
  );
}

function memberLabel(workspace) {
  const count = workspace.workspace_members?.[0]?.count || 1;
  return `${count} ${count === 1 ? 'member' : 'members'}`;
}

function Actions({ workspace, actions }) {
  if (!actions?.length) return null;
  return (
    <DropdownMenu
      items={actions}
      label={`Actions for ${workspace.name}`}
      className="relative z-10"
      buttonClassName="h-7 w-7 md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100 md:aria-expanded:opacity-100"
    />
  );
}

// The title link stretches over the whole card; the actions menu sits above it.
const STRETCHED_LINK = 'after:absolute after:inset-0 after:content-[""] focus-visible:outline-none';
const FOCUS_RING = '[&:has(a:focus-visible)]:ring-2 [&:has(a:focus-visible)]:ring-brand [&:has(a:focus-visible)]:ring-offset-2';

export default function WorkspaceCard({ workspace, isOwner, actions }) {
  const lang = getLanguage(workspace.default_language);

  return (
    <article className={`card group relative flex flex-col p-4 transition-colors hover:border-line-strong ${FOCUS_RING}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-label-sm text-ink-muted">
          <LangDot language={lang.id} /> {lang.label}
        </span>
        <Badges workspace={workspace} isOwner={isOwner} />
      </div>
      <h3 className="mt-3 truncate text-label-lg font-semibold text-ink">
        <Link to={`/editor/${workspace.id}`} className={`group-hover:underline group-hover:underline-offset-4 ${STRETCHED_LINK}`}>
          {workspace.name}
        </Link>
      </h3>
      <p className={`mt-1.5 line-clamp-2 min-h-[42px] text-body-sm ${workspace.description ? 'text-ink-muted' : 'text-ink-subtle'}`}>
        {workspace.description || 'No description'}
      </p>
      <div className="mt-4 flex h-7 items-center gap-4 border-t border-line pt-3 text-label-sm text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <GoPeople size={14} aria-hidden="true" /> {memberLabel(workspace)}
        </span>
        <span>Updated {timeAgo(workspace.updated_at)}</span>
        <span className="ml-auto -mr-1.5">
          <Actions workspace={workspace} actions={actions} />
        </span>
      </div>
    </article>
  );
}

export function WorkspaceRow({ workspace, isOwner, actions }) {
  const lang = getLanguage(workspace.default_language);

  return (
    <li className={`group relative flex items-center gap-4 px-4 py-3.5 transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-canvas-subtle ${FOCUS_RING} [&:has(a:focus-visible)]:ring-inset [&:has(a:focus-visible)]:ring-offset-0`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link to={`/editor/${workspace.id}`} className={`truncate text-label-lg font-semibold text-ink group-hover:underline group-hover:underline-offset-4 ${STRETCHED_LINK}`}>
            {workspace.name}
          </Link>
          <Badges workspace={workspace} isOwner={isOwner} />
        </div>
        <p className={`mt-1 truncate text-body-sm ${workspace.description ? 'text-ink-muted' : 'text-ink-subtle'}`}>
          {workspace.description || 'No description'}
        </p>
      </div>
      <div className="hidden shrink-0 items-center gap-5 text-label-sm text-ink-muted sm:flex">
        <span className="inline-flex w-28 items-center gap-2">
          <LangDot language={lang.id} /> {lang.label}
        </span>
        <span className="hidden w-24 items-center gap-1.5 md:inline-flex">
          <GoPeople size={14} aria-hidden="true" /> {memberLabel(workspace)}
        </span>
        <span className="w-28">Updated {timeAgo(workspace.updated_at)}</span>
      </div>
      <div className="w-7 shrink-0"><Actions workspace={workspace} actions={actions} /></div>
    </li>
  );
}
