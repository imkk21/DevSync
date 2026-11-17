import { useEffect, useState } from 'react';
import { GoCheckCircle, GoPlus, GoTrash } from 'react-icons/go';
import { supabase } from '../lib/supabase';
import useAuthStore from '../store/authStore';
import { toast } from '../store/toastStore';
import { GRADES, nextReview, nextLabel } from '../lib/flashcards';
import { celebrate } from '../lib/celebrate';
import Navbar from '../components/layout/Navbar';
import Button from '../components/ui/Button';
import FlashcardModal from '../components/ui/FlashcardModal';
import { PageLoader } from '../components/ui/LoadingSpinner';

// Daily review of your flashcards
export default function ReviewPage() {
  const user = useAuthStore((s) => s.user);
  const [cards, setCards] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [adding, setAdding] = useState(null);
  const [reviewed, setReviewed] = useState(0);
  const [showAll, setShowAll] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('flashcards').select('*').eq('user_id', user.id).order('due_at');
    setCards(data || []);
  };
  useEffect(() => { if (user) load(); }, [user?.id]);

  if (!cards) return <PageLoader label="Loading your cards…" />;
  const now = new Date().toISOString();
  const due = cards.filter((c) => c.due_at <= now);
  const card = due[0];

  const grade = async (g) => {
    const next = nextReview(card, g);
    setRevealed(false);
    setReviewed((n) => n + 1);
    setCards((list) => list.map((c) => (c.id === card.id ? { ...c, ...next } : c)));
    if (due.length === 1 && g !== 'again') celebrate();
    const { error } = await supabase.from('flashcards').update(next).eq('id', card.id);
    if (error) toast(error.message, { tone: 'error' });
  };
  const remove = async (c) => {
    setCards((list) => list.filter((x) => x.id !== c.id));
    await supabase.from('flashcards').delete().eq('id', c.id);
  };

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 pb-20 pt-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-headline-md text-ink">Review</h1>
            <p className="mt-1 text-body-md text-ink-muted">{due.length ? `${due.length} ${due.length === 1 ? 'card' : 'cards'} to go today` : 'All caught up'}{reviewed ? ` · ${reviewed} reviewed` : ''}</p>
          </div>
          <Button variant="secondary" onClick={() => setAdding({ source: 'manual' })}><GoPlus size={16} /> New card</Button>
        </div>

        {card ? (
          <section aria-label="Flashcard" className="card mt-8 p-6">
            <p className="text-label-sm text-ink-subtle">Question</p>
            <p className="mt-2 whitespace-pre-wrap text-body-lg text-ink">{card.front}</p>
            {revealed ? (
              <>
                <p className="mt-6 border-t border-line pt-4 text-label-sm text-ink-subtle">Answer</p>
                <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-code-md text-ink">{card.back}</pre>
                <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {GRADES.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => grade(g.id)}
                      className={`btn btn-md flex-col !h-auto gap-0.5 py-2 ${g.id === 'good' ? 'btn-primary' : 'btn-secondary'}`}
                    >
                      {g.label}
                      <span className="text-label-sm font-normal opacity-75">{nextLabel(card, g.id)}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <Button className="mt-6" onClick={() => setRevealed(true)}>Show answer</Button>
            )}
          </section>
        ) : (
          <div className="card mt-8 flex flex-col items-center px-6 py-16 text-center">
            <GoCheckCircle size={24} className="text-brand-fg" aria-hidden="true" />
            <h2 className="mt-4 text-headline-sm font-semibold text-ink">Nothing due right now</h2>
            <p className="mt-2 max-w-sm text-body-sm text-ink-muted">
              {cards.length ? 'Come back tomorrow.' : 'Save a failed test or a piece of code as a flashcard and it shows up here.'}
            </p>
          </div>
        )}

        {cards.length > 0 && (
          <div className="mt-10">
            <button type="button" onClick={() => setShowAll((v) => !v)} className="text-label-md text-ink-muted hover:text-ink">
              {showAll ? 'Hide' : 'Show'} all cards ({cards.length})
            </button>
            {showAll && (
              <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
                {cards.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1 truncate text-body-sm text-ink">{c.front}</span>
                    <span className="shrink-0 text-label-sm text-ink-subtle">{c.due_at <= now ? 'Due' : `Next ${new Date(c.due_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}</span>
                    <button type="button" onClick={() => remove(c)} className="icon-btn h-7 w-7" aria-label="Delete card"><GoTrash size={13} /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>
      <FlashcardModal request={adding} userId={user?.id} onClose={() => { setAdding(null); load(); }} />
    </div>
  );
}
