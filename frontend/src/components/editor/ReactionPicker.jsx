import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import useEditorStore from '../../store/editorStore';
import { socketService } from '../../services/socketService';
import { toast } from '../../store/toastStore';
import useDismiss from '../../hooks/useDismiss';

export const EMOJIS = ['👍', '🤔', '🔥', '❤️', '🎉', '👀'];

// request: { fileId, line, offset } for the line being reacted to
export default function ReactionPicker({ request, userId, workspaceId, onClose }) {
  const ref = useRef(null);
  useDismiss(ref, !!request, onClose);
  const reactions = useEditorStore((s) => s.reactions);
  const { upsertReaction, removeReaction } = useEditorStore();

  useEffect(() => {
    ref.current?.querySelector('button')?.focus();
  }, [request]);

  if (!request) return null;
  const session = socketService.collab?.get(request.fileId);
  const lineOf = (r) => {
    const index = session?.resolveAnchor(r.anchor);
    if (index == null) return r.line;
    const text = session.text.toString();
    let line = 1;
    for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++;
    return line;
  };
  const onLine = reactions.filter((r) => r.file_id === request.fileId && lineOf(r) === request.line);

  const toggle = async (emoji) => {
    const mine = onLine.find((r) => r.user_id === userId && r.emoji === emoji);
    onClose();
    if (mine) {
      removeReaction(mine.id);
      const { error } = await supabase.from('reactions').delete().eq('id', mine.id);
      if (error) toast(error.message, { tone: 'error' });
      return;
    }
    const { data, error } = await supabase
      .from('reactions')
      .insert({ workspace_id: workspaceId, file_id: request.fileId, user_id: userId, emoji, line: request.line, anchor: session?.anchorAt(request.offset) ?? null })
      .select()
      .single();
    if (error) toast(`Couldn't react: ${error.message}`, { tone: 'error' });
    else upsertReaction(data);
  };

  return createPortal(
    <div ref={ref} role="dialog" aria-label={`React to line ${request.line}`} className="menu fixed left-1/2 top-24 z-[60] -translate-x-1/2 animate-scale-in px-2 py-2">
      <p className="px-1 pb-1.5 text-label-sm text-ink-muted">React to line {request.line}</p>
      <div className="flex gap-1">
        {EMOJIS.map((emoji) => {
          const count = onLine.filter((r) => r.emoji === emoji).length;
          const mine = onLine.some((r) => r.emoji === emoji && r.user_id === userId);
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => toggle(emoji)}
              aria-pressed={mine}
              aria-label={`${emoji}${count ? ` (${count})` : ''}`}
              className={`flex h-10 min-w-10 items-center justify-center gap-1 rounded-md px-2 text-[18px] transition-colors ${mine ? 'bg-brand-soft ring-1 ring-brand/40' : 'hover:bg-canvas-muted'}`}
            >
              {emoji}
              {count > 0 && <span className="text-label-sm tabular-nums text-ink-muted">{count}</span>}
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}
