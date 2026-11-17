import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GoSearch, GoFile, GoCommentDiscussion, GoTasklist, GoProject, GoCode } from 'react-icons/go';
import { api } from '../../lib/api';
import Modal from '../ui/Modal';
import Input from '../ui/Input';

const plainPath = (p) => p.replace(/^\//, '');

// The query, highlighted inside a line of text
function Hit({ text, q }) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return <>{text.slice(0, i)}<mark className="rounded-sm bg-brand-soft px-0.5 text-ink">{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

function Group({ title, icon: Icon, children }) {
  return (
    <section>
      <h3 className="flex items-center gap-1.5 px-1 pb-1 text-label-sm font-semibold uppercase tracking-wide text-ink-subtle">
        <Icon size={12} aria-hidden="true" /> {title}
      </h3>
      <ul className="space-y-0.5">{children}</ul>
    </section>
  );
}

function Row({ to, onGo, children }) {
  return (
    <li>
      <Link to={to} onClick={onGo} className="block rounded-md px-2 py-1.5 hover:bg-canvas-subtle focus-visible:bg-canvas-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
        {children}
      </Link>
    </li>
  );
}

const Where = ({ children }) => <span className="ml-1.5 text-label-sm text-ink-subtle">{children}</span>;

// Search every workspace you're in: names, files, code, chat and tasks
export default function GlobalSearch({ isOpen, onClose }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setQ('');
      setRes(null);
    }
  }, [isOpen]);

  // Search shortly after typing stops
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setRes(null);
      return undefined;
    }
    let live = true;
    setLoading(true);
    const t = setTimeout(() => {
      api(`/api/search?q=${encodeURIComponent(query)}`)
        .then((r) => { if (live) { setRes(r); setError(''); } })
        .catch((err) => live && setError(err.message))
        .finally(() => live && setLoading(false));
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [q]);

  const count = res ? res.workspaces.length + res.files.length + res.code.length + res.messages.length + res.tasks.length : 0;
  const query = res?.q || '';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Search everything" description="Workspaces, files, code, chat and tasks in every workspace you're in." size="lg">
      <div className="space-y-4">
        <Input icon={GoSearch} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" autoFocus aria-label="Search all workspaces" autoComplete="off" />
        <div className="max-h-[60vh] space-y-4 overflow-y-auto" aria-live="polite" aria-busy={loading}>
          {error && <p className="text-body-sm text-danger">{error}</p>}
          {!res && !error && <p className="text-body-sm text-ink-muted">{q.trim().length === 1 ? 'Keep typing…' : 'Type at least two letters.'}</p>}
          {res && count === 0 && <p className="text-body-sm text-ink-muted">Nothing matches “{query}”.</p>}
          {res?.workspaces.length > 0 && (
            <Group title="Workspaces" icon={GoProject}>
              {res.workspaces.map((w) => (
                <Row key={w.id} to={`/editor/${w.id}`} onGo={onClose}>
                  <span className="text-label-md text-ink"><Hit text={w.name} q={query} /></span>
                  {w.description && <span className="block truncate text-label-sm text-ink-muted">{w.description}</span>}
                </Row>
              ))}
            </Group>
          )}
          {res?.files.length > 0 && (
            <Group title="Files" icon={GoFile}>
              {res.files.map((f) => (
                <Row key={f.id} to={`/editor/${f.workspace_id}?file=${f.id}&line=1`} onGo={onClose}>
                  <span className="font-mono text-code-sm text-ink"><Hit text={plainPath(f.path)} q={query} /></span>
                  <Where>{f.workspace}</Where>
                </Row>
              ))}
            </Group>
          )}
          {res?.code.length > 0 && (
            <Group title="Code" icon={GoCode}>
              {res.code.map((f) => (
                <li key={f.id} className="rounded-md px-2 py-1">
                  <p className="text-label-md text-ink">{plainPath(f.path)}<Where>{f.workspace}</Where></p>
                  <ul>
                    {f.lines.map((l) => (
                      <li key={l.line}>
                        <Link to={`/editor/${f.workspace_id}?file=${f.id}&line=${l.line}`} onClick={onClose} className="flex gap-2 rounded px-1 py-0.5 font-mono text-code-sm text-ink-muted hover:bg-canvas-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                          <span className="w-8 shrink-0 text-right tabular-nums text-ink-subtle">{l.line}</span>
                          <span className="truncate"><Hit text={l.text} q={query} /></span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </Group>
          )}
          {res?.messages.length > 0 && (
            <Group title="Chat" icon={GoCommentDiscussion}>
              {res.messages.map((m) => (
                <Row key={m.id} to={`/editor/${m.workspace_id}?panel=chat`} onGo={onClose}>
                  <span className="text-body-sm text-ink"><span className="font-medium">{m.author}:</span> <Hit text={m.body} q={query} /></span>
                  <Where>{m.workspace}</Where>
                </Row>
              ))}
            </Group>
          )}
          {res?.tasks.length > 0 && (
            <Group title="Tasks" icon={GoTasklist}>
              {res.tasks.map((t) => (
                <Row key={t.id} to={`/editor/${t.workspace_id}?view=tasks`} onGo={onClose}>
                  <span className={`text-body-sm ${t.status === 'done' ? 'text-ink-muted line-through' : 'text-ink'}`}><Hit text={t.title} q={query} /></span>
                  <Where>{t.workspace}</Where>
                </Row>
              ))}
            </Group>
          )}
        </div>
      </div>
    </Modal>
  );
}
