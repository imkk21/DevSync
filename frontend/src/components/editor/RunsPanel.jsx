import { useEffect, useState } from 'react';
import { GoChevronRight } from 'react-icons/go';
import { supabase } from '../../lib/supabase';
import useEditorStore from '../../store/editorStore';
import useWorkspaceStore from '../../store/workspaceStore';
import { timeAgo } from '../workspace/WorkspaceCard';
import Avatar from '../ui/Avatar';

const OK = new Set(['Accepted', 'Tests passed']);

// Everyone's recent runs in this workspace; new ones arrive live over the socket
export default function RunsPanel({ workspaceId }) {
  const runs = useEditorStore((s) => s.runs);
  const setRuns = useEditorStore((s) => s.setRuns);
  const files = useEditorStore((s) => s.files);
  const members = useWorkspaceStore((s) => s.members);
  const [open, setOpen] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase
      .from('execution_logs')
      .select('id, created_at, file_id, user_id, language, status, stdout, stderr, execution_time, memory_used')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (!alive) return;
        // Keep any that arrived over the socket while loading
        const known = new Set((data || []).map((r) => r.id));
        setRuns([...useEditorStore.getState().runs.filter((r) => !known.has(r.id)), ...(data || [])]);
        setLoaded(true);
      });
    return () => { alive = false; };
  }, [workspaceId, setRuns]);

  if (!loaded && runs.length === 0) return <p className="px-4 py-3 text-body-sm text-ink-muted">Loading runs…</p>;
  if (runs.length === 0) return <p className="px-4 py-3 text-body-sm text-ink-muted">No runs yet. Everyone's runs in this workspace show up here.</p>;

  return (
    <ul className="divide-y divide-line">
      {runs.map((r) => {
        const member = members.find((m) => m.user_id === r.user_id);
        const name = r.user_name || member?.profiles?.display_name || member?.profiles?.email || 'Someone';
        const file = files.find((f) => f.id === r.file_id);
        const expanded = open === r.id;
        const ok = OK.has(r.status);
        return (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => setOpen(expanded ? null : r.id)}
              aria-expanded={expanded}
              className="flex h-9 w-full items-center gap-2.5 px-3 text-left text-body-sm hover:bg-canvas-subtle"
            >
              <GoChevronRight size={12} className={`shrink-0 text-ink-muted transition-transform ${expanded ? 'rotate-90' : ''}`} aria-hidden="true" />
              <Avatar name={name} id={r.user_id} src={member?.profiles?.avatar_url} size={20} />
              <span className="min-w-0 truncate text-ink">
                {name} <span className="text-ink-muted">ran</span> {file?.name || 'a deleted file'}
              </span>
              <span className={`badge ml-auto shrink-0 ${ok ? 'border-brand/25 bg-brand-soft text-brand-fg' : 'border-danger/25 bg-danger-soft text-danger'}`}>{r.status || 'Finished'}</span>
              <span className="hidden w-16 shrink-0 text-right text-label-sm text-ink-subtle sm:block">{timeAgo(r.created_at)}</span>
            </button>
            {expanded && (
              <pre className="whitespace-pre-wrap break-words border-t border-line bg-canvas-subtle px-4 py-3 font-mono text-code-sm leading-relaxed">
                {r.stdout && <span className="block text-ink">{r.stdout}</span>}
                {r.stderr && <span className="block text-danger">{r.stderr}</span>}
                {!r.stdout && !r.stderr && <span className="text-ink-muted">No output.</span>}
                {r.execution_time != null && <span className="mt-2 block text-ink-subtle">{r.execution_time}s{r.memory_used ? ` · ${(r.memory_used / 1024).toFixed(1)} MB` : ''}</span>}
              </pre>
            )}
          </li>
        );
      })}
    </ul>
  );
}
