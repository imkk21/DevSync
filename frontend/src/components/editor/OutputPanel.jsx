import { useEffect, useState } from 'react';
import { GoCheckCircle, GoChevronDown, GoChevronUp, GoCircleSlash, GoClock, GoCpu, GoXCircle } from 'react-icons/go';
import useEditorStore from '../../store/editorStore';
import LoadingSpinner from '../ui/LoadingSpinner';
import Shortcut, { MOD } from '../ui/Shortcut';
import useResizable from '../../hooks/useResizable';
import TestsPanel from './TestsPanel';
import RunsPanel from './RunsPanel';

const TABS = [
  { id: 'output', label: 'Output' },
  { id: 'input', label: 'Input' },
  { id: 'tests', label: 'Tests' },
  { id: 'runs', label: 'Runs' },
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

export default function OutputPanel({ workspaceId, readOnly }) {
  const { output, isRunning, stdin, setStdin, args, setArgs, setOutput, testRun } = useEditorStore();
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState('output');
  const { size, handleProps } = useResizable({ storageKey: 'devsync:output-height', initial: 240, min: 120, max: 640, axis: 'y', direction: -1 });

  // Running always brings the output (or test results) into view
  useEffect(() => {
    if (isRunning) {
      setCollapsed(false);
      setTab('output');
    }
  }, [isRunning]);
  useEffect(() => {
    if (testRun?.running) {
      setCollapsed(false);
      setTab('tests');
    }
  }, [testRun?.running]);

  return (
    <section
      aria-label="Output"
      className="relative flex max-h-[70%] shrink-0 flex-col border-t border-line bg-canvas"
      style={collapsed ? undefined : { height: size }}
    >
      {!collapsed && <div {...handleProps} aria-label="Resize output panel" className="resize-handle-y" />}
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
                {t.id === 'input' && (stdin || args) && <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-label="(has input)" />}
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
            output && tab === 'output' && <Status output={output} />
          )}
          <div className="flex items-center">
            {output && !isRunning && tab === 'output' && (
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
          {tab === 'output' && <OutputBody output={output} isRunning={isRunning} />}
          {tab === 'tests' && <TestsPanel readOnly={readOnly} />}
          {tab === 'runs' && <RunsPanel workspaceId={workspaceId} />}
          {tab === 'input' && (
            <div className="flex h-full flex-col gap-3 p-3">
              <div>
                <label htmlFor="program-args" className="text-label-sm text-ink-muted">Command-line arguments</label>
                <input
                  id="program-args"
                  value={args}
                  onChange={(e) => setArgs(e.target.value)}
                  placeholder="--verbose input.txt"
                  spellCheck={false}
                  maxLength={1000}
                  className="input mt-1 h-9 font-mono sm:text-code-md"
                />
              </div>
              <div className="flex min-h-0 flex-1 flex-col">
                <label htmlFor="program-stdin" className="text-label-sm text-ink-muted">Standard input</label>
                <textarea
                  id="program-stdin"
                  value={stdin}
                  onChange={(e) => setStdin(e.target.value)}
                  placeholder="Passed to your program on stdin, one value per line"
                  spellCheck={false}
                  className="input input-multiline mt-1 min-h-[60px] flex-1 font-mono sm:text-code-md"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
