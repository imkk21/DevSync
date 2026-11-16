import { useEffect, useState } from 'react';
import { GoCheckCircle, GoChevronDown, GoChevronUp, GoCircleSlash, GoClock, GoCpu, GoXCircle } from 'react-icons/go';
import useEditorStore from '../../store/editorStore';
import LoadingSpinner from '../ui/LoadingSpinner';
import Shortcut, { MOD } from '../ui/Shortcut';

const TABS = [
  { id: 'output', label: 'Output' },
  { id: 'input', label: 'Input' },
];

function Status({ output }) {
  const ok = output.status?.id === 3;
  return (
    <>
      <span className={`badge ${ok ? 'border-brand/25 bg-brand-soft text-brand-fg' : 'border-danger/25 bg-danger-soft text-danger'}`}>
        {ok ? <GoCheckCircle size={12} aria-hidden="true" /> : <GoXCircle size={12} aria-hidden="true" />}
        {output.status?.description || 'Finished'}
      </span>
      {output.time && (
        <span className="hidden items-center gap-1 font-mono text-code-sm text-ink-muted sm:inline-flex" title="Run time">
          <GoClock size={12} aria-hidden="true" /> {output.time}s
        </span>
      )}
      {output.memory && (
        <span className="hidden items-center gap-1 font-mono text-code-sm text-ink-muted sm:inline-flex" title="Memory">
          <GoCpu size={12} aria-hidden="true" /> {(output.memory / 1024).toFixed(1)} MB
        </span>
      )}
    </>
  );
}

function OutputBody({ output, isRunning }) {
  if (isRunning) {
    return <p className="px-4 py-3 font-mono text-code-md text-ink-muted">Running your code…</p>;
  }
  if (!output) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-body-sm text-ink-muted">
        <p>Run your code to see its output here.</p>
        <Shortcut keys={[MOD, 'Enter']} />
      </div>
    );
  }
  const empty = !output.stdout && !output.stderr && !output.compile_output;
  return (
    <pre className="whitespace-pre-wrap break-words px-4 py-3 font-mono text-code-md leading-relaxed">
      {output.compile_output && <span className="block text-danger">{output.compile_output}</span>}
      {output.stdout && <span className="block text-ink">{output.stdout}</span>}
      {output.stderr && <span className="block text-danger">{output.stderr}</span>}
      {empty && <span className="text-ink-muted">Program finished with no output.</span>}
    </pre>
  );
}

export default function OutputPanel() {
  const { output, isRunning, stdin, setStdin, setOutput } = useEditorStore();
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState('output');

  // Running always brings the output into view
  useEffect(() => {
    if (isRunning) {
      setCollapsed(false);
      setTab('output');
    }
  }, [isRunning]);

  return (
    <section aria-label="Output" className={`flex shrink-0 flex-col border-t border-line bg-canvas ${collapsed ? '' : 'h-60'}`}>
      <div className={`flex h-9 shrink-0 items-center gap-3 pl-2 pr-1.5 ${collapsed ? '' : 'border-b border-line'}`}>
        <div role="tablist" aria-label="Output panel" className="flex h-full">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => { setTab(t.id); setCollapsed(false); }}
                className={`relative flex h-full items-center gap-1.5 px-3 text-label-md transition-colors ${
                  active && !collapsed
                    ? 'text-ink after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {t.label}
                {t.id === 'input' && stdin && <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-label="(has input)" />}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {isRunning ? (
            <span className="inline-flex items-center gap-1.5 text-label-sm text-ink-muted">
              <LoadingSpinner size="sm" className="text-brand" /> Running
            </span>
          ) : (
            output && <Status output={output} />
          )}
          <div className="flex items-center">
            {output && !isRunning && (
              <button type="button" onClick={() => setOutput(null)} className="icon-btn h-7 w-7" aria-label="Clear output" title="Clear output">
                <GoCircleSlash size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="icon-btn h-7 w-7"
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
              title={collapsed ? 'Expand panel' : 'Collapse panel'}
            >
              {collapsed ? <GoChevronUp size={16} /> : <GoChevronDown size={16} />}
            </button>
          </div>
        </div>
      </div>

      {!collapsed && (
        <div className="min-h-0 flex-1 overflow-auto" role="tabpanel">
          {tab === 'output' ? (
            <OutputBody output={output} isRunning={isRunning} />
          ) : (
            <div className="flex h-full flex-col p-3">
              <label htmlFor="program-stdin" className="sr-only">Program input (stdin)</label>
              <textarea
                id="program-stdin"
                value={stdin}
                onChange={(e) => setStdin(e.target.value)}
                placeholder="Input passed to your program on stdin, one value per line"
                spellCheck={false}
                className="input input-multiline min-h-0 flex-1 font-mono sm:text-code-md"
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
