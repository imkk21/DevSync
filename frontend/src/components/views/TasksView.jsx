import { useEffect, useMemo, useState } from 'react';
import { GoCalendar, GoCode, GoFlame, GoPlus, GoTrash } from 'react-icons/go';
import { supabase } from '../../lib/supabase';
import useEditorStore from '../../store/editorStore';
import { toast } from '../../store/toastStore';
import { celebrate } from '../../lib/celebrate';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Switch from '../ui/Switch';

const COLUMNS = [
  { id: 'todo', label: 'To do' },
  { id: 'doing', label: 'Doing' },
  { id: 'done', label: 'Done' },
];
const today = () => new Date().toISOString().slice(0, 10);
const shortDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

// Tasks and milestones for a workspace, live for everyone
export function useBoard(workspaceId) {
  const [tasks, setTasks] = useState(null);
  const [milestones, setMilestones] = useState([]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [t, m] = await Promise.all([
        supabase.from('tasks').select('*').eq('workspace_id', workspaceId).order('position'),
        supabase.from('milestones').select('*').eq('workspace_id', workspaceId).order('created_at'),
      ]);
      if (!alive) return;
      setTasks(t.data || []);
      setMilestones(m.data || []);
    };
    load();
    const scope = (table) => ({ schema: 'public', table, filter: `workspace_id=eq.${workspaceId}` });
    const channel = supabase
      .channel(`board:${workspaceId}`)
      .on('postgres_changes', { event: '*', ...scope('tasks') }, load)
      .on('postgres_changes', { event: '*', ...scope('milestones') }, load)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tasks' }, load)
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [workspaceId]);
  return { tasks, setTasks, milestones, setMilestones };
}

// Mounted fresh for each task (keyed by the caller), so the draft always starts from that task
function TaskModal({ task, onClose, people, milestones, readOnly, onSave, onDelete }) {
  const [draft, setDraft] = useState(task);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const file = useEditorStore.getState().files.find((f) => f.id === draft.file_id);
  return (
    <Modal
      isOpen
      onClose={onClose}
      title={task.id ? 'Task' : 'New task'}
      footer={readOnly ? <Button variant="secondary" onClick={onClose}>Close</Button> : (
        <>
          {task.id && <Button variant="ghost" className="mr-auto text-danger" onClick={() => onDelete(task)}><GoTrash size={14} /> Delete</Button>}
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => draft.title.trim() && onSave(draft)} disabled={!draft.title?.trim()}>{task.id ? 'Save' : 'Add task'}</Button>
        </>
      )}
    >
      <div className="space-y-4">
        <Input label="Title" autoFocus value={draft.title || ''} maxLength={200} disabled={readOnly} onChange={(e) => set({ title: e.target.value })} />
        <label className="block">
          <span className="text-label-md text-ink">Details</span>
          <textarea value={draft.description || ''} disabled={readOnly} maxLength={5000} onChange={(e) => set({ description: e.target.value })} className="input input-multiline mt-1.5" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-label-md text-ink">Assignee</span>
            <select value={draft.assignee_id || ''} disabled={readOnly} onChange={(e) => set({ assignee_id: e.target.value || null })} className="input mt-1.5">
              <option value="">Nobody</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-label-md text-ink">Due</span>
            <input type="date" value={draft.due_date || ''} disabled={readOnly} onChange={(e) => set({ due_date: e.target.value || null })} className="input mt-1.5" />
          </label>
          <label className="block">
            <span className="text-label-md text-ink">Status</span>
            <select value={draft.status} disabled={readOnly} onChange={(e) => set({ status: e.target.value })} className="input mt-1.5">
              {COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-label-md text-ink">Milestone</span>
            <select value={draft.milestone_id || ''} disabled={readOnly} onChange={(e) => set({ milestone_id: e.target.value || null })} className="input mt-1.5">
              <option value="">None</option>
              {milestones.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </label>
        </div>
        {draft.file_id && (
          <div className="rounded-md border border-line p-3">
            <p className="flex items-center gap-2 text-body-sm text-ink">
              <GoCode size={14} className="text-ink-muted" aria-hidden="true" /> Linked to <span className="font-mono">{file?.name || 'a deleted file'}{draft.line ? `:${draft.line}` : ''}</span>
              {!readOnly && <button type="button" onClick={() => set({ file_id: null, anchor: null, line: null, done_when_tests_pass: false })} className="ml-auto text-label-sm text-ink-muted hover:text-ink">Unlink</button>}
            </p>
            <div className="mt-3">
              <Switch label="Done when its tests pass" hint="Moves to Done by itself once every test for this file passes (with Run on every save on)." checked={!!draft.done_when_tests_pass} disabled={readOnly} onChange={(v) => set({ done_when_tests_pass: v })} />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function MilestoneBar({ milestone, tasks, active, onSelect }) {
  const mine = tasks.filter((t) => t.milestone_id === milestone.id);
  const done = mine.filter((t) => t.status === 'done').length;
  const pct = mine.length ? Math.round((done / mine.length) * 100) : 0;
  const overdue = milestone.due_date && milestone.due_date < today() && pct < 100;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`card min-w-[200px] p-3 text-left transition-colors ${active ? 'border-brand bg-brand-soft' : 'hover:border-line-strong'}`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-label-md text-ink">{milestone.title}</span>
        <span className="shrink-0 text-label-sm tabular-nums text-ink-muted">{pct}%</span>
      </span>
      <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-canvas-muted">
        <span className="block h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
      </span>
      <span className={`mt-2 block text-label-sm ${overdue ? 'text-danger' : 'text-ink-subtle'}`}>
        {done}/{mine.length} done{milestone.due_date ? ` · due ${shortDate(milestone.due_date)}` : ''}
      </span>
    </button>
  );
}

// Kanban board. `draft` (from "Make a task from this line") opens prefilled.
export default function TasksView({ workspaceId, userId, people, readOnly, draft, onDraftDone, onOpenCode }) {
  const { tasks, setTasks, milestones, setMilestones } = useBoard(workspaceId);
  const [editing, setEditing] = useState(null);
  const [milestoneFilter, setMilestoneFilter] = useState(null);
  const [newMilestone, setNewMilestone] = useState(null); // { title, due_date }
  const [dragId, setDragId] = useState(null);
  const [over, setOver] = useState(null);
  const personOf = (id) => people.find((p) => p.id === id);

  useEffect(() => {
    if (draft) {
      setEditing({ title: draft.title, status: 'todo', file_id: draft.fileId, anchor: draft.anchor, line: draft.line, workspace_id: workspaceId });
      onDraftDone();
    }
  }, [draft]);

  const shown = useMemo(() => (tasks || []).filter((t) => !milestoneFilter || t.milestone_id === milestoneFilter), [tasks, milestoneFilter]);

  const save = async (t) => {
    const fields = {
      title: t.title.trim(), description: t.description || null, status: t.status, assignee_id: t.assignee_id || null,
      due_date: t.due_date || null, milestone_id: t.milestone_id || null, file_id: t.file_id || null, anchor: t.anchor || null,
      line: t.line || null, done_when_tests_pass: !!t.done_when_tests_pass, completed_at: t.status === 'done' ? t.completed_at || new Date().toISOString() : null,
    };
    const res = t.id
      ? await supabase.from('tasks').update(fields).eq('id', t.id).select().single()
      : await supabase.from('tasks').insert({ ...fields, workspace_id: workspaceId, created_by: userId, position: Date.now() }).select().single();
    if (res.error) return toast(res.error.message, { tone: 'error' });
    setTasks((list) => [...(list || []).filter((x) => x.id !== res.data.id), res.data]);
    setEditing(null);
    checkMilestone(res.data, t);
  };

  // Finishing the last task of a milestone deserves a moment
  const checkMilestone = (row, before) => {
    if (row.status !== 'done' || !row.milestone_id || before.status === 'done') return;
    const rest = (tasks || []).filter((x) => x.milestone_id === row.milestone_id && x.id !== row.id);
    if (rest.every((x) => x.status === 'done')) {
      celebrate();
      toast(`Milestone complete: ${milestones.find((m) => m.id === row.milestone_id)?.title}`, { tone: 'success' });
    }
  };

  const remove = async (t) => {
    setEditing(null);
    setTasks((list) => list.filter((x) => x.id !== t.id));
    const { error } = await supabase.from('tasks').delete().eq('id', t.id);
    if (error) toast(error.message, { tone: 'error' });
  };

  // Drop a card into a column, before `beforeId` (or at the end)
  const move = async (id, status, beforeId) => {
    const task = tasks.find((t) => t.id === id);
    const column = tasks.filter((t) => t.status === status && t.id !== id).sort((a, b) => a.position - b.position);
    const index = beforeId ? column.findIndex((t) => t.id === beforeId) : column.length;
    const prev = column[index - 1]?.position ?? (column[0]?.position ?? Date.now()) - 1000;
    const next = column[index]?.position ?? prev + 2000;
    const position = (prev + next) / 2;
    if (task.status === status && Math.abs(task.position - position) < 1e-9) return;
    const patch = { status, position, completed_at: status === 'done' ? task.completed_at || new Date().toISOString() : null };
    setTasks((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    const { error } = await supabase.from('tasks').update(patch).eq('id', id);
    if (error) toast(error.message, { tone: 'error' });
    else checkMilestone({ ...task, ...patch }, task);
  };

  const addMilestone = async (e) => {
    e.preventDefault();
    if (!newMilestone.title.trim()) return;
    const { data, error } = await supabase
      .from('milestones').insert({ workspace_id: workspaceId, title: newMilestone.title.trim(), due_date: newMilestone.due_date || null, created_by: userId })
      .select().single();
    if (error) return toast(error.message, { tone: 'error' });
    setMilestones((list) => [...list.filter((m) => m.id !== data.id), data]);
    setNewMilestone(null);
  };

  if (!tasks) return <div className="p-6 text-body-sm text-ink-muted">Loading tasks…</div>;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-3 overflow-x-auto border-b border-line px-4 py-3">
        <button
          type="button"
          onClick={() => setMilestoneFilter(null)}
          aria-pressed={!milestoneFilter}
          className={`card shrink-0 px-4 py-3 text-label-md ${!milestoneFilter ? 'border-brand bg-brand-soft text-ink' : 'text-ink-muted hover:border-line-strong'}`}
        >
          All tasks
        </button>
        {milestones.map((m) => (
          <MilestoneBar key={m.id} milestone={m} tasks={tasks} active={milestoneFilter === m.id} onSelect={() => setMilestoneFilter(milestoneFilter === m.id ? null : m.id)} />
        ))}
        {!readOnly && (newMilestone ? (
          <form onSubmit={addMilestone} className="card flex shrink-0 items-center gap-2 p-2">
            <input autoFocus value={newMilestone.title} onChange={(e) => setNewMilestone({ ...newMilestone, title: e.target.value })} placeholder="Milestone, e.g. Ship login" maxLength={120} className="input h-8 w-48" aria-label="Milestone name" />
            <input type="date" value={newMilestone.due_date} onChange={(e) => setNewMilestone({ ...newMilestone, due_date: e.target.value })} className="input h-8 w-36" aria-label="Due date" />
            <Button size="sm" type="submit">Add</Button>
            <Button size="sm" variant="ghost" onClick={() => setNewMilestone(null)}>Cancel</Button>
          </form>
        ) : (
          <Button size="sm" variant="ghost" className="shrink-0" onClick={() => setNewMilestone({ title: '', due_date: '' })}><GoFlame size={14} /> New milestone</Button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-auto p-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const cards = shown.filter((t) => t.status === col.id).sort((a, b) => a.position - b.position);
          return (
            <section
              key={col.id}
              aria-label={col.label}
              onDragOver={(e) => { if (dragId) { e.preventDefault(); setOver(`${col.id}:end`); } }}
              onDrop={(e) => { e.preventDefault(); if (dragId) move(dragId, col.id, null); setDragId(null); setOver(null); }}
              className={`flex min-h-[200px] flex-col rounded-lg border bg-canvas-subtle ${over?.startsWith(col.id) ? 'border-brand' : 'border-line'}`}
            >
              <header className="flex items-center justify-between px-3 py-2.5">
                <h3 className="text-label-md text-ink">{col.label} <span className="font-normal text-ink-subtle">{cards.length}</span></h3>
                {!readOnly && col.id !== 'done' && (
                  <button type="button" onClick={() => setEditing({ title: '', status: col.id, milestone_id: milestoneFilter })} className="icon-btn h-7 w-7" aria-label={`Add a task to ${col.label}`}>
                    <GoPlus size={14} />
                  </button>
                )}
              </header>
              <ol className="flex-1 space-y-2 px-2 pb-2">
                {cards.map((t) => {
                  const person = personOf(t.assignee_id);
                  const file = t.file_id && useEditorStore.getState().files.find((f) => f.id === t.file_id);
                  const overdue = t.due_date && t.due_date < today() && t.status !== 'done';
                  return (
                    <li
                      key={t.id}
                      draggable={!readOnly}
                      onDragStart={(e) => { setDragId(t.id); e.dataTransfer.effectAllowed = 'move'; }}
                      onDragEnd={() => { setDragId(null); setOver(null); }}
                      onDragOver={(e) => { if (dragId && dragId !== t.id) { e.preventDefault(); e.stopPropagation(); setOver(`${col.id}:${t.id}`); } }}
                      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (dragId) move(dragId, col.id, t.id); setDragId(null); setOver(null); }}
                      className={`card cursor-pointer p-3 transition-shadow hover:border-line-strong ${over === `${col.id}:${t.id}` ? 'shadow-[0_-2px_0_0_rgb(var(--brand))]' : ''} ${dragId === t.id ? 'opacity-50' : ''}`}
                      onClick={() => setEditing(t)}
                    >
                      <p className={`text-body-sm ${t.status === 'done' ? 'text-ink-muted line-through' : 'text-ink'}`}>{t.title}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {file && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onOpenCode(t); }}
                            className="badge font-mono hover:border-line-strong"
                            title="Open the linked code"
                          >
                            <GoCode size={11} aria-hidden="true" /> {file.name}{t.line ? `:${t.line}` : ''}
                          </button>
                        )}
                        {t.done_when_tests_pass && <span className="badge" title="Moves to Done when its tests pass">✓ tests</span>}
                        {t.due_date && <span className={`badge ${overdue ? 'border-danger/25 bg-danger-soft text-danger' : ''}`}><GoCalendar size={11} aria-hidden="true" /> {shortDate(t.due_date)}</span>}
                        {person && <span className="ml-auto"><Avatar name={person.name} id={person.id} src={person.avatar_url} size={22} title={person.name} /></span>}
                      </div>
                    </li>
                  );
                })}
                {cards.length === 0 && <li className="px-2 py-6 text-center text-body-sm text-ink-subtle">{col.id === 'done' ? 'Nothing finished yet' : 'Drop tasks here'}</li>}
              </ol>
            </section>
          );
        })}
      </div>

      {editing && (
        <TaskModal
          key={editing.id || 'new'}
          task={editing}
          onClose={() => setEditing(null)}
          people={people}
          milestones={milestones}
          readOnly={readOnly}
          onSave={save}
          onDelete={remove}
        />
      )}
    </div>
  );
}
