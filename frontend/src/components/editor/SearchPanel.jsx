import { useDeferredValue, useMemo, useState } from 'react';
import { GoChevronRight } from 'react-icons/go';
import { VscCaseSensitive, VscRegex, VscReplace, VscReplaceAll, VscWholeWord } from 'react-icons/vsc';
import useEditorStore from '../../store/editorStore';
import { socketService } from '../../services/socketService';
import { findMatches, replacementFor } from '../../lib/workspaceFiles';
import { LOCAL } from '../../lib/collab';
import { toast } from '../../store/toastStore';
import LangDot from '../ui/LangDot';

function OptionToggle({ active, onClick, label, icon: Icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={`flex h-6 w-6 items-center justify-center rounded-sm transition-colors ${active ? 'bg-brand-soft text-brand-fg ring-1 ring-brand/40' : 'text-ink-subtle hover:bg-canvas-muted hover:text-ink'}`}
    >
      <Icon size={16} />
    </button>
  );
}

// Replace every match in one file through its shared document, so collaborators see it live
// and it can be undone with Ctrl+Z.
async function replaceInFile(fileId, query, replace, options) {
  const collab = socketService.collab;
  const wasOpen = !!collab.get(fileId);
  const session = collab.open(fileId);
  await session.ready;
  const matches = findMatches(session.text.toString(), query, { ...options, limit: Infinity });
  if (!matches.error && matches.length) {
    session.doc.transact(() => {
      for (const m of [...matches].reverse()) {
        session.text.delete(m.index, m.length);
        session.text.insert(m.index, replacementFor(m, query, replace, options));
      }
    }, LOCAL);
  }
  if (!wasOpen) {
    await session.save();
    collab.close(fileId);
  }
  return matches.error ? 0 : matches.length;
}

export default function SearchPanel({ readOnly }) {
  const files = useEditorStore((s) => s.files);
  const contentOf = useEditorStore((s) => s.contentOf);
  const revealAt = useEditorStore((s) => s.revealAt);
  const [query, setQuery] = useState('');
  const [replace, setReplace] = useState('');
  const [showReplace, setShowReplace] = useState(false);
  const [options, setOptions] = useState({ caseSensitive: false, regex: false, wholeWord: false });
  const [collapsed, setCollapsed] = useState({});
  const [busy, setBusy] = useState(false);
  const deferredQuery = useDeferredValue(query);

  const results = useMemo(() => {
    if (!deferredQuery) return { groups: [], total: 0 };
    const groups = [];
    let total = 0;
    for (const f of files) {
      if (f.is_folder) continue;
      const matches = findMatches(contentOf(f.id), deferredQuery, { ...options, limit: 500 });
      if (matches.error) return { error: matches.error, groups: [], total: 0 };
      if (matches.length) {
        groups.push({ file: f, matches });
        total += matches.length;
      }
    }
    groups.sort((a, b) => a.file.path.localeCompare(b.file.path));
    return { groups, total };
    // `files` changes whenever any file's text changes, which is when results should refresh
  }, [deferredQuery, options, files, contentOf]);

  const toggle = (key) => setOptions((o) => ({ ...o, [key]: !o[key] }));

  const replaceAll = async (groups) => {
    setBusy(true);
    try {
      let count = 0;
      for (const g of groups) count += await replaceInFile(g.file.id, query, replace, options);
      toast(`Replaced ${count} ${count === 1 ? 'match' : 'matches'} in ${groups.length} ${groups.length === 1 ? 'file' : 'files'}`, { tone: 'success' });
    } catch (err) {
      toast(`Replace failed: ${err.message}`, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-line p-3">
        <div className="flex items-start gap-1">
          {!readOnly && (
            <button
              type="button"
              onClick={() => setShowReplace((v) => !v)}
              aria-expanded={showReplace}
              aria-label={showReplace ? 'Hide replace' : 'Show replace'}
              className="icon-btn mt-1 h-7 w-5 shrink-0"
            >
              <GoChevronRight size={12} className={`transition-transform ${showReplace ? 'rotate-90' : ''}`} />
            </button>
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="relative">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search all files"
                aria-label="Search all files"
                spellCheck={false}
                className="input h-9 pr-[84px] font-mono sm:text-code-md"
              />
              <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 gap-0.5">
                <OptionToggle active={options.caseSensitive} onClick={() => toggle('caseSensitive')} label="Match case" icon={VscCaseSensitive} />
                <OptionToggle active={options.wholeWord} onClick={() => toggle('wholeWord')} label="Whole word" icon={VscWholeWord} />
                <OptionToggle active={options.regex} onClick={() => toggle('regex')} label="Regular expression" icon={VscRegex} />
              </div>
            </div>
            {showReplace && !readOnly && (
              <div className="flex gap-1">
                <input
                  value={replace}
                  onChange={(e) => setReplace(e.target.value)}
                  placeholder={options.regex ? 'Replace ($1 for groups)' : 'Replace'}
                  aria-label="Replace with"
                  spellCheck={false}
                  className="input h-9 min-w-0 flex-1 font-mono sm:text-code-md"
                />
                <button
                  type="button"
                  onClick={() => replaceAll(results.groups)}
                  disabled={busy || !results.total}
                  className="icon-btn h-9 w-9 shrink-0 border border-line-strong disabled:opacity-40"
                  aria-label="Replace all"
                  title="Replace all"
                >
                  <VscReplaceAll size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
        {results.error ? (
          <p className="text-label-sm text-danger">{results.error}</p>
        ) : query && (
          <p className="text-label-sm text-ink-muted" aria-live="polite">
            {results.total ? `${results.total} ${results.total === 1 ? 'result' : 'results'} in ${results.groups.length} ${results.groups.length === 1 ? 'file' : 'files'}` : 'No results'}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {results.groups.map(({ file, matches }) => (
          <div key={file.id}>
            <div className="group flex h-7 items-center gap-1.5 px-2 hover:bg-canvas-muted">
              <button
                type="button"
                onClick={() => setCollapsed((c) => ({ ...c, [file.id]: !c[file.id] }))}
                aria-expanded={!collapsed[file.id]}
                className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-body-sm"
              >
                <GoChevronRight size={12} className={`shrink-0 text-ink-muted transition-transform ${collapsed[file.id] ? '' : 'rotate-90'}`} aria-hidden="true" />
                <LangDot language={file.language} />
                <span className="truncate text-ink">{file.name}</span>
                <span className="truncate text-label-sm text-ink-subtle">{file.path.slice(1, -file.name.length - 1)}</span>
                <span className="ml-auto shrink-0 rounded-full bg-canvas-muted px-1.5 text-label-sm tabular-nums text-ink-muted">{matches.length}</span>
              </button>
              {showReplace && !readOnly && (
                <button
                  type="button"
                  onClick={() => replaceAll([{ file }])}
                  disabled={busy}
                  className="icon-btn h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label={`Replace all in ${file.name}`}
                  title="Replace all in this file"
                >
                  <VscReplace size={14} />
                </button>
              )}
            </div>
            {!collapsed[file.id] && (
              <ul>
                {matches.map((m) => {
                  const start = Math.max(0, m.column - 1 - 24);
                  const before = m.preview.slice(start, m.column - 1);
                  const after = m.preview.slice(m.column - 1 + m.length, m.column - 1 + m.length + 80);
                  return (
                    <li key={m.index}>
                      <button
                        type="button"
                        onClick={() => revealAt(file.id, { offset: m.index, length: m.length })}
                        title={`Line ${m.line}`}
                        className="flex h-6 w-full items-center gap-2 whitespace-pre pl-8 pr-2 text-left font-mono text-code-sm text-ink-muted hover:bg-canvas-muted"
                      >
                        <span className="w-7 shrink-0 text-right tabular-nums text-ink-subtle">{m.line}</span>
                        <span className="truncate">
                          {start > 0 && '…'}{before.trimStart()}
                          <mark className="rounded-sm bg-brand-muted text-ink">{m.preview.slice(m.column - 1, m.column - 1 + m.length)}</mark>
                          {after}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
