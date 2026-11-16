import { useCallback, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { GoFile } from 'react-icons/go';
import useEditorStore from '../../store/editorStore';
import LoadingSpinner from '../ui/LoadingSpinner';
import Shortcut, { MOD } from '../ui/Shortcut';
import useThemeStore from '../../store/themeStore';
import { THEMES, defineDevSyncThemes } from '../../lib/monacoTheme';

const OPTIONS = {
  fontSize: 14,
  lineHeight: 22,
  fontFamily: "'Monaspace Neon', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  fontLigatures: true,
  minimap: { enabled: false },
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
  glyphMargin: false,
  folding: true,
};

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center bg-canvas px-6">
      <div className="max-w-sm text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-canvas-muted text-ink-muted">
          <GoFile size={20} aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-headline-sm font-semibold text-ink">No file open</h2>
        <p className="mt-2 text-body-sm text-ink-muted">Pick a file from the sidebar, or create a new one to start coding.</p>
        <dl className="mx-auto mt-6 grid w-52 grid-cols-[1fr_auto] items-center gap-y-2.5 text-body-sm">
          <dt className="text-left text-ink-muted">Save</dt>
          <dd><Shortcut keys={[MOD, 'S']} /></dd>
          <dt className="text-left text-ink-muted">Run</dt>
          <dd><Shortcut keys={[MOD, 'Enter']} /></dd>
        </dl>
      </div>
    </div>
  );
}

export default function CodeEditor({ onContentChange, readOnly = false }) {
  const { activeFile, editorContent, language, setEditorContent, saveFile } = useEditorStore();
  const resolvedTheme = useThemeStore((s) => s.resolved);
  const saveTimeoutRef = useRef(null);
  const broadcastTimeoutRef = useRef(null);

  const handleMount = (editor, monaco) => {
    // Actions are registered once, so they read the store instead of closures
    editor.addAction({
      id: 'devsync.save',
      label: 'Save file',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: () => {
        const { activeFile: current } = useEditorStore.getState();
        if (current && !editor.getOption(monaco.editor.EditorOption.readOnly)) {
          saveFile(current.id, editor.getValue());
        }
      },
    });
    editor.addAction({
      id: 'devsync.run',
      label: 'Run code',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => useEditorStore.getState().runCode(),
    });
    // Web fonts can finish loading after Monaco measures them; re-measure so the cursor lines up
    document.fonts?.ready.then(() => monaco.editor.remeasureFonts());
    editor.focus();
  };

  const handleChange = useCallback((value) => {
    setEditorContent(value || '');

    // In read-only mode Monaco still fires onChange when a remote update is applied.
    // Never rebroadcast or save those.
    if (readOnly) return;

    // Throttled broadcast for realtime collab (100ms)
    if (onContentChange) {
      clearTimeout(broadcastTimeoutRef.current);
      broadcastTimeoutRef.current = setTimeout(() => onContentChange(value || ''), 100);
    }

    // Auto-save with debounce (2s)
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      if (activeFile) saveFile(activeFile.id, value || '');
    }, 2000);
  }, [activeFile, onContentChange, saveFile, setEditorContent, readOnly]);

  if (!activeFile) return <EmptyState />;

  return (
    <Editor
      height="100%"
      // One model per file: each keeps its own undo history, cursor and scroll position
      path={activeFile.id}
      language={language}
      value={editorContent}
      theme={THEMES[resolvedTheme]}
      beforeMount={defineDevSyncThemes}
      onChange={handleChange}
      onMount={handleMount}
      loading={<LoadingSpinner size="lg" className="text-brand" />}
      options={{ ...OPTIONS, readOnly }}
    />
  );
}
