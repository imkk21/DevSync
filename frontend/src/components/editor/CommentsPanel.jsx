import { useMemo, useState } from 'react';
import { GoCheck, GoComment, GoReply, GoTrash } from 'react-icons/go';
import { supabase } from '../../lib/supabase';
import useEditorStore from '../../store/editorStore';
import { socketService } from '../../services/socketService';
import { toast } from '../../store/toastStore';
import { timeAgo } from '../workspace/WorkspaceCard';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';
import MentionTextarea, { withMentions } from '../ui/MentionTextarea';
import { api } from '../../lib/api';

// One suggested change: a small before/after diff with accept and reject for editors
function SuggestionCard({ s, person, canDecide, onJump }) {
  const [busy, setBusy] = useState(null);
  const upsertSuggestion = useEditorStore((st) => st.upsertSuggestion);
  const decide = async (action) => {
    setBusy(action);
    try {
      upsertSuggestion(await api(`/api/suggestions/${s.id}/${action}`, { method: 'POST' }));
      toast(action === 'accept' ? 'Suggestion applied' : 'Suggestion declined', { tone: action === 'accept' ? 'success' : 'info' });
    } catch (err) {
      toast(err.message, { tone: 'error' });
    } finally {
      setBusy(null);
    }
  };
  const lines = (text, sign, cls) => text.split('\n').map((l, i) => (
    <span key={`${sign}${i}`} className={`block whitespace-pre ${cls}`}>{sign} {l}</span>
  ));
  return (
    <article className="rounded-md border border-[#0969DA]/30 bg-canvas p-3">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onJump} className="text-label-sm text-brand-fg hover:underline">Line {s.line}</button>
        <span className="truncate text-label-sm text-ink-muted">
          {s.guest_name ? `${s.guest_name} (viewer)` : person.name} · {timeAgo(s.created_at)}
        </span>
      </div>
      {s.note && <p className="mt-2 text-body-sm text-ink">{s.note}</p>}
      <pre className="mt-2 max-h-48 overflow-auto rounded-md border border-line font-mono text-code-sm leading-relaxed">
        {lines(s.original, '-', 'bg-danger-soft text-danger')}
        {lines(s.replacement, '+', 'bg-brand-soft text-brand-fg')}
      </pre>
      {s.status !== 'open' ? (
        <p className="mt-2 text-label-sm text-ink-muted">{s.status === 'accepted' ? 'Accepted' : 'Declined'}</p>
      ) : canDecide && (
        <div className="mt-2 flex justify-end gap-2">
          <Button size="sm" variant="ghost" loading={busy === 'reject'} disabled={!!busy} onClick={() => decide('reject')}>Decline</Button>
          <Button size="sm" loading={busy === 'accept'} disabled={!!busy} onClick={() => decide('accept')}>Accept</Button>
        </div>
      )}
    </article>
  );
}

// Line a comment points at now (its anchor follows edits), or where it was posted
function lineOf(comment) {
  const session = socketService.collab?.get(comment.file_id);
  const index = session?.resolveAnchor(comment.anchor);
  if (index == null) return comment.line;
  const text = session.text.toString();
  let line = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

function Composer({ people, placeholder, onSubmit, onCancel, autoFocus }) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!body.trim() || busy) return;
    setBusy(true);
    const ok = await onSubmit(body.trim());
    setBusy(false);
    if (ok) setBody('');
  };
  return (
    <div className="space-y-2">
      <MentionTextarea value={body} onChange={setBody} onSubmit={submit} people={people} placeholder={placeholder} label={placeholder} autoFocus={autoFocus} />
      <div className="flex justify-end gap-2">
        {onCancel && <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>}
        <Button size="sm" onClick={submit} loading={busy} disabled={!body.trim()}>Comment</Button>
      </div>
    </div>
  );
}

function Message({ comment, person, names, isMine, onDelete }) {
  return (
    <div className="flex gap-2.5">
      <Avatar name={person.name} id={comment.user_id} src={person.avatar_url} size={24} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-label-md text-ink">{person.name}</span>
          <span className="shrink-0 text-label-sm text-ink-subtle">{timeAgo(comment.created_at)}</span>
          {isMine && (
            <button type="button" onClick={onDelete} className="icon-btn ml-auto h-6 w-6" aria-label="Delete comment" title="Delete comment">
              <GoTrash size={12} />
            </button>
          )}
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-body-sm text-ink">{withMentions(comment.body, names)}</p>
      </div>
    </div>
  );
}

// Comment threads on the active file. `draft`: { fileId, line, offset } from "Add comment".
export default function CommentsPanel({ userId, people, draft, onDraftDone, canEdit }) {
  const { comments, suggestions, activeFile, files, revealAt, upsertComment, removeComment } = useEditorStore();
  const [showResolved, setShowResolved] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const personOf = (id) => people.find((p) => p.id === id) || { name: 'Someone' };
  const names = people.map((p) => p.name);

  const threads = useMemo(() => {
    if (!activeFile) return [];
    return comments
      .filter((c) => c.file_id === activeFile.id && !c.parent_id && (showResolved || !c.resolved))
      .map((c) => ({ ...c, line: lineOf(c), replies: comments.filter((r) => r.parent_id === c.id) }))
      .sort((a, b) => a.line - b.line || a.created_at.localeCompare(b.created_at));
    // `files` changes as text is edited, which moves the anchored lines
  }, [comments, activeFile, showResolved, files]);
  const resolvedCount = activeFile ? comments.filter((c) => c.file_id === activeFile.id && !c.parent_id && c.resolved).length : 0;

  const post = async (row) => {
    const { data, error } = await supabase.from('comments').insert({ ...row, user_id: userId, workspace_id: activeFile.workspace_id }).select().single();
    if (error) {
      toast(`Couldn't post your comment: ${error.message}`, { tone: 'error' });
      return false;
    }
    upsertComment(data);
    return true;
  };
  const setResolved = async (c, resolved) => {
    upsertComment({ ...c, resolved });
    const { error } = await supabase.from('comments').update({ resolved }).eq('id', c.id);
    if (error) toast(error.message, { tone: 'error' });
  };
  const remove = async (c) => {
    removeComment(c.id);
    const { error } = await supabase.from('comments').delete().eq('id', c.id);
    if (error) toast(error.message, { tone: 'error' });
  };

  if (!activeFile) return <p className="p-4 text-body-sm text-ink-muted">Open a file to see its comments.</p>;
  const drafting = draft?.fileId === activeFile.id;
  const fileSuggestions = suggestions
    .filter((s) => s.file_id === activeFile.id && (showResolved || s.status === 'open'))
    .map((s) => ({ ...s, line: lineOf({ ...s, anchor: s.anchor_start }) }))
    .sort((a, b) => a.line - b.line);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-line pl-4 pr-2">
        <h2 className="truncate text-label-md text-ink">Comments <span className="font-normal text-ink-muted">· {activeFile.name}</span></h2>
        {resolvedCount > 0 && (
          <button type="button" onClick={() => setShowResolved((v) => !v)} className="shrink-0 text-label-sm text-brand-fg hover:underline">
            {showResolved ? 'Hide resolved' : `Show resolved (${resolvedCount})`}
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {drafting && (
          <div className="rounded-md border border-brand bg-canvas p-3">
            <p className="mb-2 text-label-sm text-ink-muted">Line {draft.line}</p>
            <Composer
              autoFocus
              people={people}
              placeholder="Add a comment (@ to mention)"
              onCancel={onDraftDone}
              onSubmit={async (body) => {
                const session = socketService.collab?.get(activeFile.id);
                const ok = await post({ file_id: activeFile.id, line: draft.line, anchor: session?.anchorAt(draft.offset) ?? null, body });
                if (ok) onDraftDone();
                return ok;
              }}
            />
          </div>
        )}
        {fileSuggestions.length > 0 && (
          <section aria-label="Suggested changes" className="space-y-3">
            <h3 className="text-label-sm text-ink-muted">Suggested changes</h3>
            {fileSuggestions.map((s) => (
              <SuggestionCard key={s.id} s={s} person={personOf(s.user_id)} canDecide={canEdit} onJump={() => revealAt(s.file_id, { line: s.line })} />
            ))}
            {threads.length > 0 && <h3 className="pt-2 text-label-sm text-ink-muted">Comments</h3>}
          </section>
        )}
        {threads.length === 0 && !drafting && fileSuggestions.length === 0 && (
          <div className="px-2 py-8 text-center">
            <GoComment size={20} className="mx-auto text-ink-subtle" aria-hidden="true" />
            <p className="mt-3 text-body-sm text-ink-muted">No comments on this file. Right-click a line in the editor and choose <span className="text-ink">Add comment</span>.</p>
          </div>
        )}
        {threads.map((t) => (
          <article key={t.id} className={`rounded-md border border-line bg-canvas p-3 ${t.resolved ? 'opacity-70' : ''}`}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <button type="button" onClick={() => revealAt(t.file_id, { line: t.line })} className="text-label-sm text-brand-fg hover:underline">
                Line {t.line}
              </button>
              <button
                type="button"
                onClick={() => setResolved(t, !t.resolved)}
                className="inline-flex items-center gap-1 text-label-sm text-ink-muted hover:text-ink"
              >
                <GoCheck size={12} aria-hidden="true" /> {t.resolved ? 'Reopen' : 'Resolve'}
              </button>
            </div>
            <div className="space-y-3">
              <Message comment={t} person={personOf(t.user_id)} names={names} isMine={t.user_id === userId} onDelete={() => remove(t)} />
              {t.replies.map((r) => (
                <Message key={r.id} comment={r} person={personOf(r.user_id)} names={names} isMine={r.user_id === userId} onDelete={() => remove(r)} />
              ))}
            </div>
            {!t.resolved && (replyTo === t.id ? (
              <div className="mt-3">
                <Composer
                  autoFocus
                  people={people}
                  placeholder="Reply"
                  onCancel={() => setReplyTo(null)}
                  onSubmit={async (body) => {
                    const ok = await post({ file_id: t.file_id, parent_id: t.id, line: t.line, anchor: t.anchor, body });
                    if (ok) setReplyTo(null);
                    return ok;
                  }}
                />
              </div>
            ) : (
              <button type="button" onClick={() => setReplyTo(t.id)} className="mt-3 inline-flex items-center gap-1 text-label-sm text-ink-muted hover:text-ink">
                <GoReply size={12} aria-hidden="true" /> Reply
              </button>
            ))}
          </article>
        ))}
      </div>
    </div>
  );
}
