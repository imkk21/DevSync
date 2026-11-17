import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GoHistory } from 'react-icons/go';
import { api } from '../../lib/api';
import { describe } from '../editor/ActivityPanel';
import { timeAgo } from './WorkspaceCard';

const name = (path) => path.split('/').pop();
const andMore = (items, max = 2) => (items.length <= max ? items.join(' and ') : `${items.slice(0, max).join(', ')} and ${items.length - max} more`);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// Short lines about one workspace: who edited what, what happened, chat and tasks
export function summarize(u, names) {
  const byPerson = new Map();
  for (const e of u.edits) for (const p of e.people) byPerson.set(p, [...(byPerson.get(p) || []), name(e.path)]);
  const lines = [...byPerson].slice(0, 2).map(([p, files]) => `${p} edited ${andMore(files)}`);
  if (byPerson.size > 2) lines.push(`${plural(byPerson.size - 2, 'other person', 'other people')} edited files`);
  for (const a of u.activity.slice(0, 2)) lines.push(`${names[a.user_id] || 'Someone'} ${describe(a, (id) => names[id] || 'someone')}`);
  if (u.tasks.length === 1) lines.push(`Task done: ${u.tasks[0]}`);
  else if (u.tasks.length > 1) lines.push(`${u.tasks.length} tasks done`);
  if (u.messages) lines.push(plural(u.messages, 'new message'));
  return lines;
}

// Dashboard: what others did in your workspaces since you last left each one
export default function SinceLastVisit({ workspaces }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    api('/api/me/updates').then(setData).catch(() => setData(null));
  }, []);
  const nameOf = Object.fromEntries(workspaces.map((w) => [w.id, w.name]));
  const rows = (data?.updates || []).filter((u) => nameOf[u.workspace_id]).slice(0, 5);
  if (!rows.length) return null;

  return (
    <section aria-labelledby="since-last-visit" className="card mt-3 p-4">
      <h2 id="since-last-visit" className="flex items-center gap-2 text-label-md text-ink-muted">
        <GoHistory size={14} aria-hidden="true" /> Since you were last here
      </h2>
      <ul className="mt-2 divide-y divide-line">
        {rows.map((u) => {
          const lines = summarize(u, data.names);
          return (
            <li key={u.workspace_id}>
              <Link to={`/editor/${u.workspace_id}`} className="group block py-2.5 first:pt-1 last:pb-0">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-label-md text-ink group-hover:underline">{nameOf[u.workspace_id]}</span>
                  <span className="shrink-0 text-label-sm text-ink-subtle">{timeAgo(u.latest)}</span>
                </span>
                <span className="mt-0.5 block text-body-sm text-ink-muted">
                  {lines.slice(0, 3).join(' · ')}{lines.length > 3 ? ' · and more' : ''}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
