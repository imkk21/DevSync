import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { API_URL } from '../lib/api';
import Logo from '../components/ui/Logo';
import { PageLoader } from '../components/ui/LoadingSpinner';
import ReplayPlayer, { fromBase64 } from '../components/editor/ReplayPlayer';
import { LinkError } from './PublicPage';

// A "code movie": how a file was written, with the chat from the same time. Embeddable, no sign-in.
export default function MoviePage() {
  const { token, fileId } = useParams();
  const [movie, setMovie] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/public/${encodeURIComponent(token)}/replay/${encodeURIComponent(fileId)}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.message || 'This movie is no longer shared');
        setMovie({ ...body, steps: body.steps.map((s) => ({ ...s, update: fromBase64(s.data) })) });
        document.title = `${body.file.name} · ${body.workspace.name} – DevSync`;
      })
      .catch((err) => setError(err.message));
  }, [token, fileId]);

  if (error) return <LinkError message={error} />;
  if (!movie) return <PageLoader label="Loading…" />;

  return (
    <div className="flex min-h-screen flex-col bg-canvas p-4">
      <header className="mb-3 flex items-center gap-3">
        <a href="/" target="_blank" rel="noreferrer" aria-label="DevSync" className="rounded-md"><Logo /></a>
        <span className="truncate text-body-sm text-ink-muted">
          <span className="font-semibold text-ink">{movie.file.name}</span> · {movie.workspace.name}
        </span>
        <Link to={`/p/${token}`} target="_blank" className="ml-auto text-label-sm text-brand-fg hover:underline">Open workspace</Link>
      </header>
      {movie.steps.length === 0 ? (
        <p className="text-body-sm text-ink-muted">Nothing recorded for this file yet.</p>
      ) : (
        <ReplayPlayer
          steps={movie.steps}
          fileName={movie.file.name}
          nameOf={(id) => movie.names[id] || 'Someone'}
          messages={movie.messages}
          autoplay
          height="calc(100vh - 150px)"
        />
      )}
    </div>
  );
}
