// Spaced repetition (a simplified SM-2): cards you know come back later and later,
// cards you miss come back in ten minutes.
export const GRADES = [
  { id: 'again', label: 'Again', hint: '10 min' },
  { id: 'hard', label: 'Hard' },
  { id: 'good', label: 'Good' },
  { id: 'easy', label: 'Easy' },
];

const DAY = 86_400_000;

// The card's next schedule after answering with `grade`: { due_at, interval_days, ease, reps }
export function nextReview(card, grade, now = Date.now()) {
  let { interval_days: interval = 0, ease = 2.5, reps = 0 } = card;
  if (grade === 'again') {
    return { reps: 0, interval_days: 0, ease: Math.max(1.3, ease - 0.2), due_at: new Date(now + 10 * 60_000).toISOString() };
  }
  reps += 1;
  if (reps === 1) interval = grade === 'easy' ? 3 : 1;
  else if (reps === 2) interval = grade === 'easy' ? 6 : grade === 'hard' ? 2 : 3;
  else interval = Math.max(interval + 1, Math.round(interval * ease * (grade === 'hard' ? 0.8 : grade === 'easy' ? 1.3 : 1)));
  ease = Math.min(3, Math.max(1.3, ease + (grade === 'hard' ? -0.15 : grade === 'easy' ? 0.15 : 0)));
  return { reps, interval_days: interval, ease: Math.round(ease * 100) / 100, due_at: new Date(now + interval * DAY).toISOString() };
}

// Human label for when a grade would bring the card back
export function nextLabel(card, grade) {
  if (grade === 'again') return '10 min';
  const days = nextReview(card, grade).interval_days;
  return days === 1 ? '1 day' : days < 30 ? `${days} days` : `${Math.round(days / 30)} mo`;
}
