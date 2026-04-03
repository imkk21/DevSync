import { useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import useEditorStore from '../../store/editorStore';
import LoadingSpinner from '../ui/LoadingSpinner';

export default function CodeEditor({ onContentChange }) {
  const { activeFile, editorContent, language, theme, fontSize, setEditorContent, saveFile } = useEditorStore();
  const editorRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;

    // Add keybinding for Ctrl+S
    editor.addAction({
      id: 'save-file',
      label: 'Save File',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: () => {
        const currentContent = editor.getValue();
        if (activeFile) {
          saveFile(activeFile.id, currentContent);
        }
      },
    });

    editor.focus();
  };

  const handleChange = useCallback((value) => {
    setEditorContent(value || '');

    // Broadcast changes for realtime collab
    if (onContentChange) {
      onContentChange(value || '');
    }

    // Auto-save with debounce
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      if (activeFile) {
        saveFile(activeFile.id, value || '');
      }
    }, 2000);
  }, [activeFile, onContentChange, saveFile, setEditorContent]);

  const getMonacoLanguage = (lang) => {
    const map = {
      javascript: 'javascript', typescript: 'typescript', python: 'python',
      java: 'java', c: 'c', cpp: 'cpp', go: 'go', rust: 'rust',
      ruby: 'ruby', php: 'php', csharp: 'csharp', html: 'html',
      css: 'css', json: 'json', markdown: 'markdown', plaintext: 'plaintext',
    };
    return map[lang] || 'plaintext';
  };

  if (!activeFile) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface-950">
        <div className="text-center animate-fade-in">
          <div className="text-6xl mb-4 opacity-20">⌨️</div>
          <h3 className="text-lg font-medium text-surface-400 mb-2">No file open</h3>
          <p className="text-sm text-surface-600">Select a file from the sidebar to start editing</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full">
      <Editor
        height="100%"
        language={getMonacoLanguage(language)}
        value={editorContent}
        theme={theme}
        onChange={handleChange}
        onMount={handleEditorDidMount}
        loading={
          <div className="flex-1 flex items-center justify-center bg-surface-950">
            <LoadingSpinner size="lg" />
          </div>
        }
        options={{
          fontSize,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontLigatures: true,
          minimap: { enabled: true, scale: 1 },
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          renderLineHighlight: 'all',
          renderWhitespace: 'selection',
          bracketPairColorization: { enabled: true },
          autoClosingBrackets: 'always',
          autoClosingQuotes: 'always',
          formatOnPaste: true,
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnCommitCharacter: true,
          wordWrap: 'off',
          lineNumbers: 'on',
          glyphMargin: false,
          folding: true,
          contextmenu: true,
          padding: { top: 16 },
        }}
      />
    </div>
  );
}
