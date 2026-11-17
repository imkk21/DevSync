import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { GoLinkExternal, GoRepo, GoGlobe } from 'react-icons/go';
import { API_URL } from '../lib/api';
import Logo from '../components/ui/Logo';
import ThemeMenu from '../components/ui/ThemeMenu';
import Avatar from '../components/ui/Avatar';
import LangDot from '../components/ui/LangDot';
import { PageLoader } from '../components/ui/LoadingSpinner';
import { LinkError } from './PublicPage';

const DAY = 86_400_000;
const WEEKS = 26;
// Links are typed by their owner: only ever render real web addresses
const safeUrl = (url) => (/^https?:\/\//i.test(url || '') ? url : null);

// Activity over the last six months, one square per day (GitHub style)
function Heatmap({ counts }) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const start = today.getTime() - (WEEKS * 7 - 1) * DAY;
  const first = start - new Date(start).getUTCDay() * DAY; // columns start on Sunday
  const cells = [];
  for (let t = first, i = 0; t <= today.getTime(); t += DAY, i++) {
    const day = new Date(t).toISOString().slice(0, 10);
    cells.push({ day, n: counts[day] || 0, x: Math.floor(i / 7), y: i % 7 });
  }
  const max = Math.max(1, ...cells.map((c) => c.n));
  const level = (n) => (n === 0 ? 0 : Math.ceil((n / max) * 4));
  const total = cells.reduce((a, c) => a + c.n, 0);
  const cols = cells[cells.length - 1].x + 1;
  return (
    <figure>
      <svg viewBox={`0 0 ${cols * 13} ${7 * 13}`} className="w-full" role="img" aria-label={`${total} actions in the last six months`}>
        {cells.map((c) => (
          <rect key={c.day} x={c.x * 13} y={c.y * 13} width="10" height="10" rx="2" className={`heat-${level(c.n)}`}>
            <title>{`${c.n} on ${new Date(c.day).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })}`}</title>
          </rect>
        ))}
      </svg>
      <figcaption className="mt-2 text-label-sm text-ink-subtle">{total} actions in the last six months</figcaption>
    </figure>
  );
}

// Someone's public page: what they chose to show, no sign-in needed
export default function PortfolioPage() {
  const { username } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch(`${API_URL}/api/u/${encodeURIComponent(username)}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.message || 'No one goes by that name here');
        setData(body);
        document.title = `${body.profile.display_name || body.profile.username} – DevSync`;
      })
      .catch((err) => setError(err.message));
  }, [username]);

  if (error) return <LinkError message={error} />;
  if (!data) return <PageLoader />;
  const { profile, projects, stats, heatmap } = data;
  const name = profile.display_name || profile.username;
  const links = [
    ['GitHub', safeUrl(profile.links?.github), GoRepo],
    ['LinkedIn', safeUrl(profile.links?.linkedin), GoLinkExternal],
    ['Website', safeUrl(profile.links?.website), GoGlobe],
  ].filter(([, url]) => url);

  return (
    <div className="min-h-screen bg-canvas">
      <header className="flex h-12 items-center gap-3 border-b border-line px-4">
        <Link to="/" aria-label="DevSync home" className="rounded-md"><Logo /></Link>
        <ThemeMenu className="ml-auto" />
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar name={name} src={profile.avatar_url} size={80} />
          <div className="min-w-0">
            <h1 className="text-headline-md text-ink">{name}</h1>
            <p className="text-body-md text-ink-muted">@{profile.username}</p>
            {profile.bio && <p className="mt-2 max-w-xl whitespace-pre-wrap text-body-md text-ink">{profile.bio}</p>}
            {links.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                {links.map(([label, url, Icon]) => (
                  <li key={label}>
                    <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 text-label-md text-ink-muted hover:text-ink">
                      <Icon size={14} aria-hidden="true" /> {label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <dl className="mt-8 grid grid-cols-3 gap-3">
          {[['Active days', stats.activeDays], ['Code runs', stats.runs], ['Suggestions accepted', stats.suggestionsAccepted]].map(([label, n]) => (
            <div key={label} className="card p-4">
              <dt className="text-label-sm text-ink-subtle">{label}</dt>
              <dd className="mt-1 text-headline-sm font-semibold tabular-nums text-ink">{n.toLocaleString()}</dd>
            </div>
          ))}
        </dl>

        <section className="card mt-3 p-4" aria-label="Activity">
          <Heatmap counts={heatmap} />
        </section>

        <h2 className="mt-10 text-label-lg text-ink">Projects</h2>
        {projects.length ? (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {projects.map((p) => (
              <li key={p.public_token}>
                <Link to={`/p/${p.public_token}`} className="card block h-full p-4 hover:border-line-strong">
                  <span className="text-body-md font-semibold text-ink">{p.name}</span>
                  {p.description && <p className="mt-1 line-clamp-2 text-body-sm text-ink-muted">{p.description}</p>}
                  <span className="mt-3 flex items-center gap-1.5 text-label-sm text-ink-subtle"><LangDot language={p.default_language} /> {p.default_language}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-body-sm text-ink-muted">No projects shown yet.</p>
        )}
      </main>
    </div>
  );
}
