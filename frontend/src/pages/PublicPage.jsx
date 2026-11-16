import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { GoAlert, GoEye } from 'react-icons/go';
import { API_URL } from '../lib/api';
import { THEMES, defineDevSyncThemes } from '../lib/monacoTheme';
import { languageForFile } from '../lib/languages';
import useThemeStore from '../store/themeStore';
import useAuthStore from '../store/authStore';
import Logo from '../components/ui/Logo';
import LangDot from '../components/ui/LangDot';
import ThemeMenu from '../components/ui/ThemeMenu';
import { PageLoader } from '../components/ui/LoadingSpinner';

// Read-only view of a workspace shared with a public link. No sign-in needed.
export default function PublicPage() {
  const { token } = useParams();
  const theme = useThemeStore((s) => s.resolved);
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [fileId, setFileId] = useState(null);

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

  const files = useMemo(
    () => (data?.files || []).filter((f) => !f.is_folder).sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true })),
    [data],
  );
  useEffect(() => {
    if (files.length && !fileId) setFileId((files.find((f) => /readme\.md$/i.test(f.name)) || files[0]).id);
  }, [files, fileId]);
  const file = files.find((f) => f.id === fileId);

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-canvas px-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-canvas-muted text-ink-muted"><GoAlert size={20} aria-hidden="true" /></span>
        <h1 className="mt-4 text-headline-sm font-semibold text-ink">{error}</h1>
        <Link to="/" className="btn btn-md btn-secondary mt-6">Go to DevSync</Link>
      </div>
    );
  }
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
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav aria-label="Files" className="max-h-40 shrink-0 overflow-y-auto border-b border-line bg-canvas-subtle p-2 md:max-h-none md:w-64 md:border-b-0 md:border-r">
          <ul>
            {files.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => setFileId(f.id)}
                  aria-current={f.id === fileId || undefined}
                  className={`flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-body-sm ${f.id === fileId ? 'bg-brand-soft font-medium text-ink' : 'text-ink-muted hover:bg-canvas-muted hover:text-ink'}`}
                >
                  <LangDot language={f.language || languageForFile(f.name)} />
                  <span className="truncate">{f.path.slice(1)}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <main className="min-h-0 min-w-0 flex-1">
          {file && (
            <Editor
              height="100%"
              path={`public/${file.id}`}
              value={file.content || ''}
              language={languageForFile(file.name)}
              theme={THEMES[theme]}
              beforeMount={defineDevSyncThemes}
              options={{ readOnly: true, domReadOnly: true, minimap: { enabled: false }, scrollBeyondLastLine: false, fontSize: 14, lineHeight: 22, padding: { top: 12 }, automaticLayout: true }}
            />
          )}
        </main>
      </div>
    </div>
  );
}
