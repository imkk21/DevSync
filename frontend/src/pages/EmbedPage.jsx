import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { GoPlay } from 'react-icons/go';
import { API_URL } from '../lib/api';
import { getLanguage } from '../lib/languages';
import useEditorStore from '../store/editorStore';
import Button from '../components/ui/Button';
import { PageLoader } from '../components/ui/LoadingSpinner';
import LiveView from '../components/live/LiveView';
import { usePublicWorkspace, LinkError } from './PublicPage';

// Live, runnable snippet for other websites: <iframe src="/embed/<token>?file=/main.py">
export default function EmbedPage() {
  const { token } = useParams();
  const [params] = useSearchParams();
  const { data, error } = usePublicWorkspace(token);
  const activeFile = useEditorStore((s) => s.activeFile);
  const [output, setOutput] = useState(null);
  const [running, setRunning] = useState(false);

  if (error) return <LinkError message={error} />;
  if (!data) return <PageLoader label="Loading…" />;

  const runnable = activeFile && getLanguage(activeFile.language).judge0Id;
  const run = async () => {
    setRunning(true);
    setOutput(null);
    try {
      const res = await fetch(`${API_URL}/api/public/${encodeURIComponent(token)}/run`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileId: activeFile.id }),
      });
      const body = await res.json().catch(() => ({}));
      setOutput(res.ok ? body : { stderr: body.message || 'Run failed' });
    } catch {
      setOutput({ stderr: 'Run failed. Check your connection.' });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-canvas">
      <LiveView token={token} data={data} compact initialPath={params.get('file') || undefined}>
        <div className="shrink-0 border-t border-line">
          <div className="flex h-10 items-center gap-2 px-3">
            <Button size="sm" onClick={run} loading={running} disabled={!runnable}>
              {!running && <GoPlay size={14} />} Run
            </Button>
            <a href={`/p/${token}`} target="_blank" rel="noreferrer" className="ml-auto text-label-sm text-ink-muted hover:text-ink">Open in DevSync</a>
          </div>
          {output && (
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap border-t border-line px-3 py-2 font-mono text-code-sm">
              {output.compile_output && <span className="block text-danger">{output.compile_output}</span>}
              {output.stdout && <span className="block text-ink">{output.stdout}</span>}
              {output.stderr && <span className="block text-danger">{output.stderr}</span>}
              {!output.stdout && !output.stderr && !output.compile_output && <span className="text-ink-muted">No output.</span>}
            </pre>
          )}
        </div>
      </LiveView>
    </div>
  );
}
