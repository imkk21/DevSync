import { useEffect, useState } from 'react';
import { GoBeaker, GoCheckCircle, GoPlus, GoTrash, GoXCircle } from 'react-icons/go';
import { supabase } from '../../lib/supabase';
import useEditorStore from '../../store/editorStore';
import { getLanguage } from '../../lib/languages';
import { toast } from '../../store/toastStore';
import Button from '../ui/Button';

function useTests(file) {
  const [tests, setTests] = useState(null);
  useEffect(() => {
    if (!file) return;
    let alive = true;
    const load = async () => {
      const { data, error } = await supabase.from('test_cases').select('*').eq('file_id', file.id).order('created_at');
      if (alive) setTests(error ? [] : data);
    };
    load();
    // Tests are shared: anyone's change reloads the list
    const channel = supabase
      .channel(`tests:${file.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'test_cases', filter: `file_id=eq.${file.id}` }, load)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'test_cases' }, load)
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [file?.id]);
  return [tests, setTests];
}

function TestCase({ test, index, result, readOnly, onChange, onDelete }) {
  const [draft, setDraft] = useState(test);
  useEffect(() => setDraft(test), [test.input, test.expected_output]);
  const field = (key, label) => (
    <label className="min-w-0 flex-1">
      <span className="text-label-sm text-ink-muted">{label}</span>
      <textarea
        value={draft[key]}
        readOnly={readOnly}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
        onBlur={() => draft[key] !== test[key] && onChange({ [key]: draft[key] })}
        rows={2}
        spellCheck={false}
        className="input input-multiline mt-1 min-h-[52px] font-mono sm:text-code-sm"
      />
    </label>
  );
  return (
    <li className="rounded-md border border-line p-3">
      <div className="flex items-center gap-2">
        <span className="text-label-md text-ink">Test {index + 1}</span>
        {result && (result.passed ? (
          <span className="badge border-brand/25 bg-brand-soft text-brand-fg"><GoCheckCircle size={12} aria-hidden="true" /> Passed</span>
        ) : (
          <span className="badge border-danger/25 bg-danger-soft text-danger"><GoXCircle size={12} aria-hidden="true" /> Failed</span>
        ))}
        {!readOnly && (
          <button type="button" onClick={onDelete} className="icon-btn ml-auto h-7 w-7" aria-label={`Delete test ${index + 1}`} title="Delete test">
            <GoTrash size={14} />
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        {field('input', 'Input')}
        {field('expected_output', 'Expected output')}
      </div>
      {result && !result.passed && (
        <div className="mt-2">
          <span className="text-label-sm text-ink-muted">Got</span>
          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded-md border border-danger/25 bg-danger-soft px-3 py-2 font-mono text-code-sm text-ink">
            {result.output?.compile_output || result.output?.stderr || result.output?.stdout || `(no output) ${result.output?.status?.description || ''}`}
          </pre>
        </div>
      )}
    </li>
  );
}

// Input/expected-output pairs for the active file, shared with the workspace
export default function TestsPanel({ readOnly }) {
  const { activeFile, language, testRun, runTests, isRunning } = useEditorStore();
  const [tests, setTests] = useTests(activeFile);
  const runnable = !!getLanguage(language).judge0Id;

  if (!activeFile) return <p className="px-4 py-3 text-body-sm text-ink-muted">Open a file to add tests for it.</p>;

  const add = async () => {
    const { data, error } = await supabase
      .from('test_cases').insert({ file_id: activeFile.id, workspace_id: activeFile.workspace_id, input: '', expected_output: '' }).select().single();
    if (error) return toast(`Couldn't add a test: ${error.message}`, { tone: 'error' });
    setTests((t) => (t?.some((x) => x.id === data.id) ? t : [...(t || []), data]));
  };
  const update = async (id, patch) => {
    setTests((t) => t.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from('test_cases').update(patch).eq('id', id);
    if (error) toast(`Couldn't save the test: ${error.message}`, { tone: 'error' });
  };
  const remove = async (id) => {
    setTests((t) => t.filter((x) => x.id !== id));
    const { error } = await supabase.from('test_cases').delete().eq('id', id);
    if (error) toast(`Couldn't delete the test: ${error.message}`, { tone: 'error' });
  };

  const results = testRun?.fileId === activeFile.id ? testRun.results : {};
  const ran = tests?.filter((t) => results[t.id]);
  const passed = ran?.filter((t) => results[t.id].passed).length;

  return (
    <div className="p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => runTests(tests)} loading={testRun?.running} disabled={!tests?.length || !runnable || isRunning}>
          {!testRun?.running && <GoBeaker size={14} />} Run tests
        </Button>
        {!readOnly && (
          <Button size="sm" variant="secondary" onClick={add}>
            <GoPlus size={14} /> Add test
          </Button>
        )}
        {ran?.length > 0 && !testRun?.running && (
          <span className={`text-label-md ${passed === ran.length ? 'text-brand-fg' : 'text-danger'}`} aria-live="polite">
            {passed}/{ran.length} passed
          </span>
        )}
        {testRun?.error && testRun.fileId === activeFile.id && <span className="text-label-md text-danger">{testRun.error}</span>}
      </div>
      {tests === null ? (
        <p className="mt-3 text-body-sm text-ink-muted">Loading tests…</p>
      ) : tests.length === 0 ? (
        <p className="mt-3 max-w-md text-body-sm text-ink-muted">
          A test gives your program some input and checks what it prints. Trailing spaces and blank lines at the end don't count.
        </p>
      ) : (
        <ol className="mt-3 space-y-2">
          {tests.map((t, i) => (
            <TestCase key={t.id} test={t} index={i} result={results[t.id]} readOnly={readOnly} onChange={(patch) => update(t.id, patch)} onDelete={() => remove(t.id)} />
          ))}
        </ol>
      )}
    </div>
  );
}
