import { useEffect, useRef, useState } from 'react';
import { GoCircleSlash, GoSync, GoX } from 'react-icons/go';
import useEditorStore from '../../store/editorStore';
import useThemeStore from '../../store/themeStore';
import { buildHtmlPreview } from '../../lib/workspaceFiles';
import { languageForFile } from '../../lib/languages';

export const previewKind = (file) => {
  const lang = file && !file.is_folder ? languageForFile(file.name) : null;
  return lang === 'markdown' || lang === 'html' ? lang : null;
};

const MD_COLORS = {
  light: { bg: '#FFFFFF', text: '#1F2328', muted: '#57606A', line: '#E5E7EB', subtle: '#F6F8F7', link: '#0A7A28' },
  dark: { bg: '#0D1110', text: '#E6EDE9', muted: '#9AA6A0', line: '#252D2A', subtle: '#141A18', link: '#4AC26B' },
};

function markdownDocument(html, theme) {
  const c = MD_COLORS[theme];
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>
body{margin:0;padding:24px 28px;background:${c.bg};color:${c.text};font:16px/1.65 "Mona Sans",system-ui,sans-serif;max-width:760px}
h1,h2,h3{line-height:1.25;margin:1.4em 0 .6em;font-weight:600}h1{font-size:1.75em}h2{font-size:1.35em;padding-bottom:.3em;border-bottom:1px solid ${c.line}}
h1:first-child,h2:first-child{margin-top:0}a{color:${c.link}}p,ul,ol,pre,table,blockquote{margin:0 0 1em}
code{font:13px/1.5 "Monaspace Neon",ui-monospace,monospace;background:${c.subtle};border:1px solid ${c.line};border-radius:4px;padding:.1em .35em}
pre{background:${c.subtle};border:1px solid ${c.line};border-radius:6px;padding:12px 14px;overflow:auto}pre code{background:none;border:0;padding:0}
blockquote{margin-left:0;padding-left:1em;border-left:3px solid ${c.line};color:${c.muted}}
table{border-collapse:collapse}th,td{border:1px solid ${c.line};padding:6px 12px}img{max-width:100%}hr{border:0;border-top:1px solid ${c.line}}
</style></head><body>${html}</body></html>`;
}

const LOG_TONE = { error: 'text-danger', warn: 'text-[#9A6700] dark:text-[#D29922]', info: 'text-ink', log: 'text-ink' };

// Live preview of the active Markdown or HTML file. HTML runs in a sandboxed frame with its
// local CSS and JS inlined; its console output shows underneath.
export default function PreviewPane({ file, onClose }) {
  const files = useEditorStore((s) => s.files);
  const contentOf = useEditorStore((s) => s.contentOf);
  const theme = useThemeStore((s) => s.resolved);
  const kind = previewKind(file);
  const [doc, setDoc] = useState('');
  const [logs, setLogs] = useState([]);
  const [reloads, setReloads] = useState(0);
  const frame = useRef(null);

  // Rebuild shortly after typing stops
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const text = contentOf(file.id);
      if (kind === 'markdown') {
        const { marked } = await import('marked');
        if (!cancelled) setDoc(markdownDocument(marked.parse(text), theme));
        return;
      }
      const byPath = new Map(files.filter((f) => !f.is_folder).map((f) => [f.path, f.id]));
      setDoc(buildHtmlPreview(file.path, text, (p) => (byPath.has(p) ? contentOf(byPath.get(p)) : undefined)));
      setLogs([]);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [files, file.id, file.path, kind, theme, contentOf, reloads]);

  useEffect(() => {
    const onMessage = (e) => {
      if (e.source !== frame.current?.contentWindow || e.data?.devsync !== 'console') return;
      setLogs((l) => [...l.slice(-199), { level: e.data.level, text: String(e.data.text).slice(0, 2000) }]);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const errors = logs.filter((l) => l.level === 'error').length;

  return (
    <section aria-label={`Preview of ${file.name}`} className="flex h-full min-w-0 flex-col bg-canvas">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-line bg-canvas-subtle pl-3 pr-1.5">
        <span className="truncate text-label-md text-ink">Preview</span>
        <span className="truncate text-label-sm text-ink-subtle">{file.name}</span>
        <div className="ml-auto flex items-center">
          {kind === 'html' && (
            <button type="button" onClick={() => setReloads((n) => n + 1)} className="icon-btn h-7 w-7" aria-label="Reload preview" title="Reload preview">
              <GoSync size={14} />
            </button>
          )}
          <button type="button" onClick={onClose} className="icon-btn h-7 w-7" aria-label="Close preview" title="Close preview">
            <GoX size={14} />
          </button>
        </div>
      </div>
      <iframe
        ref={frame}
        title={`Preview of ${file.name}`}
        srcDoc={doc}
        // No allow-same-origin: the page can't read DevSync's storage or session
        sandbox={kind === 'html' ? 'allow-scripts allow-modals allow-forms allow-popups' : 'allow-popups allow-popups-to-escape-sandbox'}
        className={`min-h-0 w-full flex-1 border-0 ${kind === 'html' ? 'bg-white' : 'bg-canvas'}`}
      />
      {kind === 'html' && (
        <details className="group shrink-0 border-t border-line" open={errors > 0 || undefined}>
          <summary className="flex h-8 cursor-pointer list-none items-center gap-2 px-3 text-label-sm text-ink-muted hover:text-ink">
            Console
            {logs.length > 0 && <span className={`rounded-full px-1.5 tabular-nums ${errors ? 'bg-danger-soft text-danger' : 'bg-canvas-muted'}`}>{logs.length}</span>}
            {logs.length > 0 && (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setLogs([]); }}
                className="icon-btn ml-auto h-6 w-6"
                aria-label="Clear console"
                title="Clear console"
              >
                <GoCircleSlash size={12} />
              </button>
            )}
          </summary>
          <ol className="max-h-40 overflow-y-auto px-3 pb-2 font-mono text-code-sm">
            {logs.length === 0 && <li className="text-ink-subtle">Nothing logged yet.</li>}
            {logs.map((l, i) => (
              <li key={i} className={`whitespace-pre-wrap break-words border-b border-line py-1 last:border-0 ${LOG_TONE[l.level] || 'text-ink'}`}>{l.text}</li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
