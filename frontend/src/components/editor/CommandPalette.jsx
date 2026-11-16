import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GoCommandPalette, GoFile, GoHash } from 'react-icons/go';
import useEditorStore from '../../store/editorStore';
import LangDot from '../ui/LangDot';
import Shortcut from '../ui/Shortcut';

const PREFIX = { commands: '>', line: ':', files: '' };

// Lower is better; null means no match. Name start > name > path > letters in order.
function score(q, name, path = name) {
  if (!q) return 0;
  const n = name.toLowerCase();
  if (n.startsWith(q)) return 0;
  if (n.includes(q)) return 1;
  if (path.toLowerCase().includes(q)) return 2;
  let i = 0;
  for (const ch of path.toLowerCase()) if (ch === q[i]) i++;
  return i === q.length ? 3 : null;
}

// Quick open (files), commands ("> ..."), and go to line (": 42").
// commands: [{ id, label, shortcut?: string[], run, hidden? }]
export default function CommandPalette({ mode, onClose, commands }) {
  const [query, setQuery] = useState(PREFIX[mode] ?? '');
  const [index, setIndex] = useState(0);
  const files = useEditorStore((s) => s.files);
  const activeFileId = useEditorStore((s) => s.activeFileId);
  const listId = useId();
  const listRef = useRef(null);

  const kind = query.startsWith('>') ? 'commands' : query.startsWith(':') ? 'line' : 'files';
  const q = query.replace(/^[>:]/, '').trim().toLowerCase();

  const items = useMemo(() => {
    if (kind === 'line') {
      const line = parseInt(q, 10);
      if (!activeFileId) return [{ id: 'none', label: 'Open a file first', disabled: true }];
      return [{
        id: 'line',
        label: line > 0 ? `Go to line ${line}` : 'Type a line number',
        icon: GoHash,
        disabled: !(line > 0),
        run: () => useEditorStore.getState().revealAt(activeFileId, { line }),
      }];
    }
    const ranked = kind === 'commands'
      ? commands.filter((c) => !c.hidden).map((c) => ({ ...c, s: score(q, c.label) }))
      : files.filter((f) => !f.is_folder).map((f) => ({
        id: f.id,
        label: f.name,
        detail: f.path.slice(1, -f.name.length - 1),
        language: f.language,
        s: score(q, f.name, f.path),
        run: () => useEditorStore.getState().openFile(f),
      }));
    return ranked.filter((x) => x.s !== null).sort((a, b) => a.s - b.s || a.label.localeCompare(b.label)).slice(0, 60);
  }, [kind, q, commands, files, activeFileId]);

  useEffect(() => { setIndex(0); }, [kind, q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  const choose = (item) => {
    if (!item || item.disabled) return;
    onClose();
    // After the palette is gone, so focus can move to the editor
    setTimeout(() => item.run(), 0);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setIndex((i) => (i + step + items.length) % Math.max(items.length, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(items[index]);
    }
  };

  const placeholder = { files: 'Search files by name (type > for commands, : for a line)', commands: 'Type a command', line: 'Line number' }[kind];

  return createPortal(
    <div className="fixed inset-0 z-[65] flex justify-center px-4 pt-[12vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Command palette" className="menu flex h-fit max-h-[60vh] w-full max-w-xl animate-scale-in flex-col p-0">
        <div className="flex items-center gap-2 border-b border-line px-3">
          {kind === 'commands' ? <GoCommandPalette size={16} className="text-ink-subtle" aria-hidden="true" /> : <GoFile size={16} className="text-ink-subtle" aria-hidden="true" />}
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={items[index] ? `${listId}-${index}` : undefined}
            aria-autocomplete="list"
            spellCheck={false}
            className="h-11 min-w-0 flex-1 bg-transparent text-body-sm text-ink outline-none placeholder:text-ink-subtle"
          />
        </div>
        <ul ref={listRef} id={listId} role="listbox" className="overflow-y-auto p-1">
          {items.length === 0 && <li className="px-3 py-6 text-center text-body-sm text-ink-muted">No matches</li>}
          {items.map((item, i) => (
            <li
              key={item.id}
              id={`${listId}-${i}`}
              data-index={i}
              role="option"
              aria-selected={i === index}
              aria-disabled={item.disabled || undefined}
              onMouseMove={() => setIndex(i)}
              onClick={() => choose(item)}
              className={`flex h-8 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-body-sm ${i === index ? 'bg-canvas-muted text-ink' : 'text-ink-muted'} ${item.disabled ? 'cursor-default opacity-60' : ''}`}
            >
              {item.language !== undefined ? <LangDot language={item.language} /> : item.icon && <item.icon size={14} aria-hidden="true" />}
              <span className="truncate text-ink">{item.label}</span>
              {item.detail && <span className="truncate text-label-sm text-ink-subtle">{item.detail}</span>}
              {item.shortcut && <Shortcut keys={item.shortcut} className="ml-auto shrink-0" />}
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
