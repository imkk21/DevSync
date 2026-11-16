import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { GoAlert, GoEye } from 'react-icons/go';
import { API_URL } from '../lib/api';
import useAuthStore from '../store/authStore';
import Logo from '../components/ui/Logo';
import ThemeMenu from '../components/ui/ThemeMenu';
import { PageLoader } from '../components/ui/LoadingSpinner';
import LiveView from '../components/live/LiveView';

export function usePublicWorkspace(token) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch(`${API_URL}/api/public/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.message || 'This link is no longer shared');
        setData(body);
        document.title = `${body.workspace.name} – DevSync`;
      })
      .catch((err) => setError(err.message));
  }, [token]);
  return { data, error };
}

export function LinkError({ message }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-canvas px-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-canvas-muted text-ink-muted"><GoAlert size={20} aria-hidden="true" /></span>
      <h1 className="mt-4 text-headline-sm font-semibold text-ink">{message}</h1>
      <Link to="/" className="btn btn-md btn-secondary mt-6">Go to DevSync</Link>
    </div>
  );
}

// A workspace shared with a public link: watch it live (read-only), chat with the people coding,
// suggest changes. No sign-in needed.
export default function PublicPage() {
  const { token } = useParams();
  const user = useAuthStore((s) => s.user);
  const { data, error } = usePublicWorkspace(token);

  if (error) return <LinkError message={error} />;
  if (!data) return <PageLoader label="Opening shared workspace…" />;

  return (
    <div className="flex h-screen flex-col bg-canvas">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line px-3">
        <Link to="/" aria-label="DevSync home" className="rounded-md"><Logo /></Link>
        <div className="mx-1 h-5 w-px bg-line" />
        <span className="truncate text-body-sm font-semibold text-ink">{data.workspace.name}</span>
        <span className="badge shrink-0"><GoEye size={12} aria-hidden="true" /> Read-only</span>
        <div className="ml-auto flex items-center gap-2">
          <ThemeMenu className="hidden sm:block" />
          <Link to={user ? '/dashboard' : '/login'} className="btn btn-sm btn-primary">{user ? 'Your workspaces' : 'Code with DevSync'}</Link>
        </div>
      </header>
      <LiveView token={token} data={data} />
    </div>
  );
}
