import { useEffect, useState } from 'react';
import { GoCheckCircle, GoPlus, GoX } from 'react-icons/go';
import { supabase } from '../../lib/supabase';
import { toast } from '../../store/toastStore';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Switch from '../ui/Switch';

// Polls and quizzes of a workspace with their votes, live
export function usePolls(workspaceId) {
  const [polls, setPolls] = useState([]);
  const [votes, setVotes] = useState([]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [p, v] = await Promise.all([
        supabase.from('polls').select('*').eq('workspace_id', workspaceId).order('created_at'),
        supabase.from('poll_votes').select('poll_id, user_id, choice').eq('workspace_id', workspaceId),
      ]);
      if (!alive) return;
      setPolls(p.data || []);
      setVotes(v.data || []);
    };
    load();
    const scope = (table) => ({ schema: 'public', table, filter: `workspace_id=eq.${workspaceId}` });
    const channel = supabase
      .channel(`polls:${workspaceId}`)
      .on('postgres_changes', { event: '*', ...scope('polls') }, load)
      .on('postgres_changes', { event: '*', ...scope('poll_votes') }, load)
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [workspaceId]);
  return { polls, setPolls, votes, setVotes };
}

export function PollComposer({ isOpen, onClose, workspaceId, userId, onCreated }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [quiz, setQuiz] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [busy, setBusy] = useState(false);
  const filled = options.map((o) => o.trim()).filter(Boolean);

  const reset = () => { setQuestion(''); setOptions(['', '']); setQuiz(false); setCorrect(0); };
  const submit = async (e) => {
    e.preventDefault();
    if (!question.trim() || filled.length < 2) return toast('Add a question and at least two answers.');
    setBusy(true);
    const kept = options.map((o, i) => ({ o: o.trim(), i })).filter((x) => x.o);
    const { data, error } = await supabase.from('polls').insert({
      workspace_id: workspaceId, question: question.trim(), options: kept.map((x) => x.o), created_by: userId,
      correct: quiz ? Math.max(0, kept.findIndex((x) => x.i === correct)) : null,
    }).select().single();
    setBusy(false);
    if (error) return toast(error.message, { tone: 'error' });
    onCreated(data);
    reset();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={quiz ? 'New quiz question' : 'New poll'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="poll-form" loading={busy}>Post</Button></>}
    >
      <form id="poll-form" onSubmit={submit} className="space-y-4">
        <Input label="Question" value={question} maxLength={300} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. Which sort is stable?" />
        <fieldset>
          <legend className="text-label-md text-ink">Answers</legend>
          <ul className="mt-2 space-y-2">
            {options.map((o, i) => (
              <li key={i} className="flex items-center gap-2">
                {quiz && (
                  <input type="radio" name="correct" checked={correct === i} onChange={() => setCorrect(i)} aria-label={`Answer ${i + 1} is correct`} className="h-4 w-4 accent-[rgb(var(--brand))]" />
                )}
                <input value={o} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))} maxLength={100} placeholder={`Answer ${i + 1}`} aria-label={`Answer ${i + 1}`} className="input h-9" />
                {options.length > 2 && (
                  <button type="button" onClick={() => { setOptions(options.filter((_, j) => j !== i)); if (correct >= i && correct > 0) setCorrect(correct - 1); }} className="icon-btn h-8 w-8" aria-label={`Remove answer ${i + 1}`}><GoX size={14} /></button>
                )}
              </li>
            ))}
          </ul>
          {options.length < 6 && <Button size="sm" variant="ghost" className="mt-2" onClick={() => setOptions([...options, ''])}><GoPlus size={14} /> Add an answer</Button>}
        </fieldset>
        <Switch label="Quiz" hint="Mark the right answer. It's revealed when you close the question." checked={quiz} onChange={setQuiz} />
      </form>
    </Modal>
  );
}

// One poll in the chat: vote by clicking, results update live
export function PollCard({ poll, votes, userId, canClose, onVote, onClose }) {
  const mine = votes.find((v) => v.poll_id === poll.id && v.user_id === userId)?.choice;
  const counts = poll.options.map((_, i) => votes.filter((v) => v.poll_id === poll.id && v.choice === i).length);
  const total = counts.reduce((a, b) => a + b, 0);
  const quiz = poll.correct !== null && poll.correct !== undefined;
  const reveal = quiz && poll.closed;
  const showResults = mine !== undefined || poll.closed;
  return (
    <div className="rounded-lg border border-line bg-canvas p-3">
      <p className="text-label-sm text-ink-muted">{quiz ? 'Quiz' : 'Poll'}{poll.closed ? ' · closed' : ''} · {total} {total === 1 ? 'vote' : 'votes'}</p>
      <p className="mt-1 text-label-md text-ink">{poll.question}</p>
      <ul className="mt-3 space-y-1.5">
        {poll.options.map((option, i) => {
          const pct = total ? Math.round((counts[i] / total) * 100) : 0;
          const right = reveal && poll.correct === i;
          return (
            <li key={i}>
              <button
                type="button"
                disabled={poll.closed}
                onClick={() => onVote(poll, i)}
                aria-pressed={mine === i}
                className={`relative flex w-full items-center gap-2 overflow-hidden rounded-md border px-3 py-1.5 text-left text-body-sm transition-colors disabled:cursor-default ${mine === i ? 'border-brand' : 'border-line hover:border-line-strong'} ${right ? 'ring-1 ring-brand' : ''}`}
              >
                {showResults && <span aria-hidden="true" className={`absolute inset-y-0 left-0 ${right ? 'bg-brand-soft' : 'bg-canvas-muted'}`} style={{ width: `${pct}%` }} />}
                <span className="relative min-w-0 flex-1 truncate text-ink">{option}</span>
                {right && <GoCheckCircle size={14} className="relative text-brand-fg" aria-label="Correct answer" />}
                {showResults && <span className="relative shrink-0 tabular-nums text-label-sm text-ink-muted">{pct}%</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {reveal && mine !== undefined && (
        <p className={`mt-2 text-label-sm ${mine === poll.correct ? 'text-brand-fg' : 'text-danger'}`}>{mine === poll.correct ? 'You got it right' : 'Not quite this time'}</p>
      )}
      {canClose && !poll.closed && <button type="button" onClick={() => onClose(poll)} className="mt-2 text-label-sm text-ink-muted hover:text-ink">{quiz ? 'Close and reveal the answer' : 'Close poll'}</button>}
    </div>
  );
}
