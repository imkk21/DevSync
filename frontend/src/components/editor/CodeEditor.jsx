import { useEffect, useMemo, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { GoFile } from 'react-icons/go';
import useEditorStore from '../../store/editorStore';
import useSettingsStore from '../../store/settingsStore';
import LoadingSpinner from '../ui/LoadingSpinner';
import Shortcut, { MOD } from '../ui/Shortcut';
import useThemeStore from '../../store/themeStore';
import { THEMES, defineDevSyncThemes } from '../../lib/monacoTheme';
import { bindModel, showRemoteCursors } from '../../lib/monacoBinding';
import { socketService } from '../../services/socketService';
import { toast } from '../../store/toastStore';
import { languageForFile } from '../../lib/languages';

const OPTIONS = {
  lineHeight: 22,
  fontFamily: "'Monaspace Neon', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  fontLigatures: true,
  padding: { top: 12, bottom: 12 },
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  cursorBlinking: 'smooth',
  cursorSmoothCaretAnimation: 'on',
  renderLineHighlight: 'all',
  renderWhitespace: 'selection',
  bracketPairColorization: { enabled: true },
  guides: { indentation: true, bracketPairs: false },
  autoClosingBrackets: 'always',
  autoClosingQuotes: 'always',
  formatOnPaste: true,
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: true,
  scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10, useShadows: false },
  lineNumbersMinChars: 3,
  lineDecorationsWidth: 14, // room for comment markers
  glyphMargin: false,
  folding: true,
  automaticLayout: true, // follow panel resizes
};

// Ask the page to do something (open a dialog, show comments). EditorPage listens.
export const requestAction = (detail) => window.dispatchEvent(new CustomEvent('devsync:action', { detail }));

// The main editor, so page-level commands (palette, menus) can run Monaco actions on it
let mainEditor = null;
export const runEditorAction = (id) => mainEditor?.getAction(id)?.run();

// One model binding per file, shared by every editor showing it (main and split pane)
const bindings = new Map(); // fileId -> { session, model, destroy, editor }

// Vim keys come from monaco-vim on the same CDN as Monaco, loaded through Monaco's AMD loader
let vimLoader;
function loadVim(monaco) {
  vimLoader ??= new Promise((resolve, reject) => {
    const amd = window.require;
    if (!amd?.config || !window.define) return reject(new Error('editor loader unavailable'));
    window.define('monaco-editor/esm/vs/editor/editor.api', [], () => monaco);
    amd.config({ paths: { 'monaco-vim': 'https://cdn.jsdelivr.net/npm/monaco-vim@0.4.4/dist/monaco-vim.umd' } });
    amd(['monaco-vim'], resolve, reject);
  }).catch((err) => {
    vimLoader = null;
    throw err;
  });
  return vimLoader;
}

export function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center bg-canvas px-6">
      <div className="max-w-sm text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-canvas-muted text-ink-muted">
          <GoFile size={20} aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-headline-sm font-semibold text-ink">No file open</h2>
        <p className="mt-2 text-body-sm text-ink-muted">Pick a file from the sidebar, or create a new one to start coding.</p>
        <dl className="mx-auto mt-6 grid w-56 grid-cols-[1fr_auto] items-center gap-y-2.5 text-body-sm">
          <dt className="text-left text-ink-muted">Go to file</dt>
          <dd><Shortcut keys={[MOD, 'P']} /></dd>
          <dt className="text-left text-ink-muted">All commands</dt>
          <dd><Shortcut keys={[MOD, 'Shift', 'P']} /></dd>
          <dt className="text-left text-ink-muted">Run</dt>
          <dd><Shortcut keys={[MOD, 'Enter']} /></dd>
        </dl>
      </div>
    </div>
  );
}

// `fileId`: the file to show. `primary`: the main editor (owns model cleanup and jump requests);
// the split pane passes false.
export default function CodeEditor({ fileId, readOnly = false, primary = true }) {
  // Just the name: the file object changes on every keystroke
  const fileName = useEditorStore((s) => s.files.find((f) => f.id === fileId)?.name);
  const status = useEditorStore((s) => s.fileStatus[fileId]);
  const connection = useEditorStore((s) => s.connection);
  const reveal = useEditorStore((s) => (s.reveal?.fileId === fileId ? s.reveal : null));
  const comments = useEditorStore((s) => s.comments);
  const visibleKey = useEditorStore((s) => [...s.openFiles.map((f) => f.id), s.rightPane?.fileId].join());
  const settings = useSettingsStore();
  const resolvedTheme = useThemeStore((s) => s.resolved);
  const [mounted, setMounted] = useState(null); // { editor, monaco }
  const [bound, setBound] = useState(null); // fileId whose model is linked
  const [slow, setSlow] = useState(false);
  const fileIdRef = useRef(fileId);
  fileIdRef.current = fileId;
  const vimStatus = useRef(null);
  const ready = status === 'saved' || status === 'unsaved';

  // Only mention the connection if syncing takes a noticeable moment
  useEffect(() => {
    setSlow(false);
    if (ready || !fileId) return;
    const t = setTimeout(() => setSlow(true), 800);
    return () => clearTimeout(t);
  }, [ready, fileId]);

  const handleMount = (editor, monaco) => {
    const session = () => socketService.collab?.get(fileIdRef.current);
    const save = async () => {
      const { formatOnSave } = useSettingsStore.getState();
      if (formatOnSave && !editor.getOption(monaco.editor.EditorOption.readOnly)) {
        await editor.getAction('editor.action.formatDocument')?.run().catch(() => {});
      }
      if (fileIdRef.current) useEditorStore.getState().saveFile(fileIdRef.current);
    };
    // Actions are registered once, so they read refs and the store instead of closures
    editor.addAction({ id: 'devsync.save', label: 'Save file', keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS], run: save });
    editor.addAction({
      id: 'devsync.run',
      label: 'Run code',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => useEditorStore.getState().runCode(),
    });
    const selectionInfo = () => {
      const model = editor.getModel();
      const sel = editor.getSelection();
      return { model, sel, text: sel && !sel.isEmpty() ? model.getValueInRange(sel) : model.getValue() };
    };
    editor.addAction({
      id: 'devsync.comment',
      label: 'Add comment',
      contextMenuGroupId: 'devsync',
      contextMenuOrder: 1,
      run: () => {
        const { model, sel } = selectionInfo();
        const line = sel.startLineNumber;
        requestAction({ type: 'comment', fileId: fileIdRef.current, line, offset: model.getOffsetAt({ lineNumber: line, column: 1 }) });
      },
    });
    editor.addAction({
      id: 'devsync.image',
      label: 'Share code as image',
      contextMenuGroupId: 'devsync',
      contextMenuOrder: 2,
      run: () => {
        const { model, text } = selectionInfo();
        requestAction({ type: 'image', fileId: fileIdRef.current, text, language: model.getLanguageId() });
      },
    });
    // Undo only your own edits, never a collaborator's
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ, () => session()?.undo.undo());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyZ, () => session()?.undo.redo());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyY, () => session()?.undo.redo());
    // Taking over the keyboard or mouse stops following someone
    const stopFollowing = () => useEditorStore.getState().following && useEditorStore.getState().follow(null);
    editor.onKeyDown(stopFollowing);
    editor.onMouseDown((e) => {
      stopFollowing();
      if (e.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_DECORATIONS && e.target.element?.classList.contains('comment-marker')) {
        requestAction({ type: 'show-comments', fileId: fileIdRef.current, line: e.target.position?.lineNumber });
      }
    });
    // Web fonts can finish loading after Monaco measures them; re-measure so the cursor lines up
    document.fonts?.ready.then(() => monaco.editor.remeasureFonts());
    if (primary) {
      mainEditor = editor;
      editor.onDidDispose(() => mainEditor === editor && (mainEditor = null));
      editor.focus();
    }
    setMounted({ editor, monaco });
  };

  // Link the visible model to the file's shared document once it has synced
  useEffect(() => {
    const session = fileId && socketService.collab?.open(fileId);
    if (!mounted || !session) return;
    const { editor, monaco } = mounted;
    let cancelled = false;
    let stopCursors;
    setBound(null);
    session.ready.then(() => {
      const model = monaco.editor.getModel(monaco.Uri.parse(fileId));
      if (cancelled || !model) return;
      let binding = bindings.get(fileId);
      if (binding?.session !== session || binding.model !== model) {
        binding?.destroy();
        binding = Object.assign(bindModel(session, model, monaco), { session, model });
        bindings.set(fileId, binding);
      }
      binding.editor = editor;
      stopCursors = showRemoteCursors(editor, session, monaco, () => useEditorStore.getState().following);
      setBound(fileId);
    });
    return () => {
      cancelled = true;
      stopCursors?.();
    };
  }, [mounted, fileId]);

  // Closed tabs: unlink and free their models (once, from the main editor)
  useEffect(() => {
    if (!primary || !mounted) return;
    const visible = new Set(visibleKey.split(','));
    for (const [id, binding] of bindings) {
      if (visible.has(id)) continue;
      binding.destroy();
      if (!binding.model.isDisposed()) binding.model.dispose();
      bindings.delete(id);
    }
  }, [primary, visibleKey, mounted]);

  // Jump requests: search results, go to line, comments
  useEffect(() => {
    if (!reveal || !mounted || bound !== fileId || !primary) return;
    const { editor, monaco } = mounted;
    const model = editor.getModel();
    if (!model) return;
    let range;
    if (reveal.line) {
      const line = Math.min(Math.max(1, reveal.line), model.getLineCount());
      range = new monaco.Range(line, 1, line, 1);
    } else {
      const from = model.getPositionAt(reveal.offset);
      const to = model.getPositionAt(reveal.offset + (reveal.length || 0));
      range = new monaco.Range(from.lineNumber, from.column, to.lineNumber, to.column);
    }
    editor.setSelection(range);
    editor.revealRangeInCenterIfOutsideViewport(range);
    editor.focus();
    useEditorStore.getState().clearReveal();
  }, [reveal, mounted, bound, fileId, primary]);

  // Comment markers in the gutter; they follow their line as code changes
  useEffect(() => {
    if (!mounted || bound !== fileId) return;
    const { editor, monaco } = mounted;
    const session = socketService.collab?.get(fileId);
    const decorations = editor.createDecorationsCollection();
    const render = () => {
      const model = editor.getModel();
      if (!model || !session) return;
      const byLine = new Map();
      for (const c of comments) {
        if (c.file_id !== fileId || c.parent_id || c.resolved) continue;
        const index = session.resolveAnchor(c.anchor);
        const line = index != null ? model.getPositionAt(index).lineNumber : Math.min(c.line || 1, model.getLineCount());
        byLine.set(line, [...(byLine.get(line) || []), c]);
      }
      decorations.set([...byLine].map(([line, list]) => ({
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          linesDecorationsClassName: 'comment-marker',
          linesDecorationsTooltip: `${list.length} ${list.length === 1 ? 'comment' : 'comments'}`,
          overviewRuler: { color: '#08872B99', position: monaco.editor.OverviewRulerLane.Left },
          stickiness: 1,
        },
      })));
    };
    render();
    const off = session?.on((type) => type === 'text' && render());
    return () => {
      off?.();
      decorations.clear();
    };
  }, [mounted, bound, fileId, comments]);

  // Vim keys
  useEffect(() => {
    if (!mounted || !settings.vim) return;
    let vim;
    let cancelled = false;
    loadVim(mounted.monaco)
      .then((MonacoVim) => {
        if (!cancelled) vim = MonacoVim.initVimMode(mounted.editor, vimStatus.current);
      })
      .catch(() => {
        if (!cancelled && primary) toast("Vim keys couldn't load. Check your connection and try again.", { tone: 'error' });
      });
    return () => {
      cancelled = true;
      vim?.dispose();
    };
  }, [mounted, settings.vim, primary]);

  const { fontSize, tabSize, wordWrap, minimap, lineNumbers } = settings;
  const options = useMemo(() => ({
    ...OPTIONS,
    readOnly: readOnly || !ready,
    fontSize,
    tabSize,
    wordWrap: wordWrap ? 'on' : 'off',
    minimap: { enabled: minimap },
    lineNumbers: lineNumbers ? 'on' : 'off',
  }), [readOnly, ready, fontSize, tabSize, wordWrap, minimap, lineNumbers]);

  if (!fileName) return null;

  return (
    <div className="relative flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        <Editor
          height="100%"
          // One model per file: each keeps its own cursor and scroll position
          path={fileId}
          language={languageForFile(fileName)}
          defaultValue={useEditorStore.getState().contentOf(fileId)}
          theme={THEMES[resolvedTheme]}
          beforeMount={defineDevSyncThemes}
          onMount={handleMount}
          keepCurrentModel // models are shared between panes and freed above
          loading={<LoadingSpinner size="lg" className="text-brand" />}
          options={options}
        />
        {slow && !ready && status !== 'error' && (
          <div role="status" className="absolute inset-x-0 top-0 flex items-center gap-2 border-b border-line bg-canvas-subtle px-4 py-2 text-body-sm text-ink-muted">
            <LoadingSpinner size="sm" />
            {connection === 'offline' ? "Can't reach the server. Retrying…" : 'Connecting…'}
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-x-0 top-0 border-b border-danger/25 bg-danger-soft px-4 py-2 text-body-sm text-danger">
            This file couldn't be opened. It may have been deleted.
          </div>
        )}
      </div>
      {settings.vim && <div ref={vimStatus} aria-live="polite" className="h-6 shrink-0 border-t border-line bg-canvas-subtle px-3 font-mono text-code-sm leading-6 text-ink-muted" />}
    </div>
  );
}
