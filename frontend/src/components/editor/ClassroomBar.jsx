import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { toast } from '../../store/toastStore';
import useWorkspaceStore from '../../store/workspaceStore';

const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : Math.min(n % 10, 4) % 4] || 'th'}`;

// In a student's classroom copy: raise your hand, and during a race see the clock and your place.
// `refresh` changes when the teacher starts or stops a race.
export default function ClassroomBar({ workspace, refresh }) {
  const [race, setRace] = useState(null); // { endsAt, board }
  const [, tick] = useState(0);
  const raised = !!workspace.hand_raised_at;

  useEffect(() => {
    let alive = true;
    const load = () => api(`/api/workspaces/${workspace.id}/race`).then((r) => alive && setRace(r)).catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => { alive = false; clearInterval(t); };
  }, [workspace.id, refresh]);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const toggleHand = async () => {
    const note = raised ? '' : window.prompt('What do you need help with? (optional)') ?? null;
    if (note === null) return;
    try {
      useWorkspaceStore.getState().setCurrentWorkspace(await api(`/api/workspaces/${workspace.id}/hand`, { method: 'POST', body: { raised: !raised, note } }));
      toast(raised ? 'Hand lowered' : 'Your teacher can see your raised hand', { tone: 'success' });
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  };

  const left = race?.endsAt ? Math.max(0, Math.round((Date.parse(race.endsAt) - Date.now()) / 1000)) : 0;
  const place = race?.board.findIndex((b) => b.you) + 1;
  const me = race?.board.find((b) => b.you);

  return (
    <div className="flex shrink-0 items-center gap-2">
      {left > 0 && (
        <span className="badge border-brand/25 bg-brand-soft text-brand-fg" title={race.board.slice(0, 5).map((b, i) => `${i + 1}. ${b.name} ${b.passed}/${b.total}`).join('\n')}>
          Race <span className="font-mono tabular-nums">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</span>
          {place > 0 && <span>· {ordinal(place)} of {race.board.length}{me?.total ? ` · ${me.passed}/${me.total}` : ''}</span>}
        </span>
      )}
      <button
        type="button"
        onClick={toggleHand}
        aria-pressed={raised}
        className={`btn btn-sm ${raised ? 'btn-primary' : 'btn-secondary'}`}
        title={raised ? 'Lower your hand' : 'Ask your teacher for help'}
      >
        <span aria-hidden="true">✋</span> <span className="hidden lg:inline">{raised ? 'Hand raised' : 'Raise hand'}</span>
      </button>
    </div>
  );
}
