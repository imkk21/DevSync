import { useRef, useState } from 'react';
import Avatar from './Avatar';

// Textarea that suggests workspace members after "@". Enter submits (Shift+Enter for a new line).
// people: [{ id, name, avatar_url }]
export default function MentionTextarea({ value, onChange, onSubmit, people, placeholder, label, rows = 2, autoFocus, className = '' }) {
  const ref = useRef(null);
  const [mention, setMention] = useState(null); // { start, query }
  const [index, setIndex] = useState(0);

  const matches = mention
    ? people.filter((p) => p.name.toLowerCase().includes(mention.query.toLowerCase())).slice(0, 6)
    : [];

  const track = (text, caret) => {
    const m = /(^|\s)@([^\s@]*(?: [^\s@]*)?)$/.exec(text.slice(0, caret));
    setMention(m ? { start: caret - m[2].length - 1, query: m[2] } : null);
    setIndex(0);
  };

  const pick = (person) => {
    const caret = ref.current.selectionStart;
    const next = `${value.slice(0, mention.start)}@${person.name} ${value.slice(caret)}`;
    onChange(next);
    setMention(null);
    requestAnimationFrame(() => {
      const at = mention.start + person.name.length + 2;
      ref.current?.setSelectionRange(at, at);
      ref.current?.focus();
    });
  };

  const onKeyDown = (e) => {
    if (matches.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setIndex((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        pick(matches[index]);
        return;
      }
      if (e.key === 'Escape') {
        e.stopPropagation();
        setMention(null);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (value.trim()) onSubmit();
    }
  };

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        rows={rows}
        autoFocus={autoFocus}
        aria-label={label}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          track(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setMention(null), 150)}
        className={`input input-multiline min-h-0 py-2 ${className}`}
      />
      {matches.length > 0 && (
        <ul role="listbox" aria-label="Mention someone" className="menu absolute bottom-full left-0 z-20 mb-1 w-56">
          {matches.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === index}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(p)}
                className={`menu-item ${i === index ? 'bg-canvas-muted' : ''}`}
              >
                <Avatar name={p.name} id={p.id} src={p.avatar_url} size={20} />
                <span className="truncate">{p.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// "@Name" segments emphasised in rendered text
export function withMentions(text, names) {
  if (!names.length) return text;
  const pattern = new RegExp(`(@(?:${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}))`, 'g');
  return text.split(pattern).map((part, i) => (i % 2 ? <strong key={i} className="font-semibold text-brand-fg">{part}</strong> : part));
}
