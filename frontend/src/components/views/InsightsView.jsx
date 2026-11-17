import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import Avatar from '../ui/Avatar';
import LoadingSpinner from '../ui/LoadingSpinner';
import Alert from '../ui/Alert';

const MOOD = ['😫', '😕', '😐', '🙂', '😀'];
const short = (day) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const ago = (iso) => {
  if (!iso) return 'Not in 30 days';
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`;
};

// One series per day, as thin bars from a shared baseline. Hover a bar for its value.
function DailyBars({ title, days, field }) {
  const max = Math.max(1, ...days.map((d) => d[field]));
  const total = days.reduce((a, d) => a + d[field], 0);
  const W = 600;
  const H = 120;
  const step = W / days.length;
  return (
    <figure className="card p-4">
      <figcaption className="flex items-baseline justify-between">
        <span className="text-label-md text-ink">{title}</span>
        <span className="text-label-sm tabular-nums text-ink-muted">{total.toLocaleString()} in 30 days</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="mt-3 w-full" role="img" aria-label={`${title}: ${total} in the last 30 days, most on one day ${max}`}>
        <line x1="0" x2={W} y1={H} y2={H} className="stroke-line" strokeWidth="1" />
        {days.map((d, i) => {
          const h = d[field] ? Math.max(3, (d[field] / max) * (H - 4)) : 0;
          return (
            <g key={d.day}>
              <rect x={i * step} y="0" width={step} height={H} fill="transparent">
                <title>{`${short(d.day)}: ${d[field]}`}</title>
              </rect>
              {h > 0 && <rect x={i * step + 2} y={H - h} width={Math.max(2, step - 4)} height={h} rx="2" className="pointer-events-none fill-brand" />}
            </g>
          );
        })}
        <text x="0" y={H + 14} className="fill-ink-subtle text-[11px]">{short(days[0].day)}</text>
        <text x={W} y={H + 14} textAnchor="end" className="fill-ink-subtle text-[11px]">Today</text>
      </svg>
    </figure>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div className="card p-4">
      <dt className="text-label-sm text-ink-subtle">{label}</dt>
      <dd className="mt-1 text-headline-sm font-semibold tabular-nums text-ink">{value}</dd>
      {hint && <dd className="mt-0.5 text-label-sm text-ink-muted">{hint}</dd>}
    </div>
  );
}

// Owner-only: how the workspace has been going over the last 30 days
export default function InsightsView({ workspaceId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api(`/api/workspaces/${workspaceId}/insights`).then(setData).catch((err) => setError(err.message));
  }, [workspaceId]);

  if (error) return <div className="p-6"><Alert>{error}</Alert></div>;
  if (!data) return <div className="flex h-full items-center justify-center"><LoadingSpinner size="lg" className="text-brand" /></div>;

  const runs = data.days.reduce((a, d) => a + d.runs, 0);
  const passed = data.days.reduce((a, d) => a + d.passed, 0);
  const lastMood = data.mood[data.mood.length - 1];

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-4 pb-16 pt-6">
        <h1 className="text-headline-sm font-semibold text-ink">Insights</h1>
        <p className="mt-1 text-body-sm text-ink-muted">The last 30 days. Only you, the owner, can see this.</p>

        <dl className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Runs that passed" value={runs ? `${Math.round((passed / runs) * 100)}%` : '–'} hint={`${passed} of ${runs} runs`} />
          <Stat label="Open tasks" value={data.tasks.open} hint={data.tasks.overdue ? `${data.tasks.overdue} overdue` : 'None overdue'} />
          <Stat label="Tasks done" value={data.tasks.done} />
          <Stat
            label="Team mood"
            value={lastMood ? <span title={`${lastMood.average.toFixed(1)} of 5`}>{MOOD[Math.round(lastMood.average) - 1]} {lastMood.average.toFixed(1)}</span> : '–'}
            hint={lastMood ? `Week of ${short(lastMood.week)} · ${lastMood.responses} answers` : 'No check-ins yet'}
          />
        </dl>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <DailyBars title="Saves" days={data.days} field="edits" />
          <DailyBars title="Code runs" days={data.days} field="runs" />
        </div>

        <section className="mt-8" aria-labelledby="ins-people">
          <h2 id="ins-people" className="text-label-lg text-ink">People</h2>
          <div className="mt-3 overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-left text-body-sm">
              <thead className="bg-canvas-subtle text-label-sm text-ink-muted">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">Name</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Saves</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Runs</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Focus</th>
                  <th scope="col" className="px-4 py-2 font-medium">Last active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.members.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2 text-ink"><Avatar id={m.id} name={m.name} src={m.avatar_url} size={22} /> {m.name}<span className="text-label-sm text-ink-subtle">{m.role}</span></span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink">{m.edits}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink">{m.runs}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink">{m.focusMinutes ? `${m.focusMinutes} min` : '–'}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{ago(m.lastSeen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <section aria-labelledby="ins-files">
            <h2 id="ins-files" className="text-label-lg text-ink">Busiest files</h2>
            {data.topFiles.length ? (
              <ol className="mt-3 space-y-1.5">
                {data.topFiles.map((f) => (
                  <li key={f.path} className="flex items-center justify-between gap-3 text-body-sm">
                    <span className="truncate font-mono text-code-sm text-ink">{f.path.replace(/^\//, '')}</span>
                    <span className="shrink-0 tabular-nums text-ink-muted">{f.saves} saves</span>
                  </li>
                ))}
              </ol>
            ) : <p className="mt-2 text-body-sm text-ink-muted">No edits yet.</p>}
          </section>
          <section aria-labelledby="ins-mood">
            <h2 id="ins-mood" className="text-label-lg text-ink">Mood by week</h2>
            <p className="mt-1 text-body-sm text-ink-muted">The average of weekly check-ins, once at least two people answer. Single answers are never shown.</p>
            {data.mood.length ? (
              <ol className="mt-3 space-y-1.5">
                {data.mood.map((w) => (
                  <li key={w.week} className="flex items-center justify-between gap-3 text-body-sm">
                    <span className="text-ink">Week of {short(w.week)}</span>
                    <span className="tabular-nums text-ink-muted">{MOOD[Math.round(w.average) - 1]} {w.average.toFixed(1)} · {w.responses}</span>
                  </li>
                ))}
              </ol>
            ) : <p className="mt-2 text-body-sm text-ink-muted">Check-ins show up here once the team answers.</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
