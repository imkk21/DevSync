import { useEffect, useRef, useState } from 'react';
import { GoCommentDiscussion } from 'react-icons/go';
import { supabase } from '../../lib/supabase';
import useEditorStore from '../../store/editorStore';
import { toast } from '../../store/toastStore';
import Avatar from '../ui/Avatar';
import MentionTextarea, { withMentions } from '../ui/MentionTextarea';
import ToggleGroup from '../ui/ToggleGroup';
import { socketService } from '../../services/socketService';

// Live-stream viewers' chat (not stored): shown when someone watches through the public link
function ViewerChat({ workspaceId }) {
  const messages = useEditorStore((s) => s.viewerChat);
  const [text, setText] = useState('');
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [messages.length]); // braces: newer browsers return a promise here
  const send = () => {
    if (!text.trim()) return;
    socketService.socket?.emit('spectate:chat', { workspaceId, text });
    setText('');
  };
  return (
    <>
      <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 text-body-sm" aria-live="polite">
        {messages.length === 0 && <li className="text-ink-muted">Nobody has said anything yet. Messages here aren't saved.</li>}
        {messages.map((m, i) => (
          <li key={i}>
            <span className={`font-medium ${m.host ? 'text-brand-fg' : 'text-ink'}`}>{m.name}</span>{' '}
            <span className="whitespace-pre-wrap break-words text-ink-muted">{m.text}</span>
          </li>
        ))}
        <li ref={end} />
      </ol>
      <div className="shrink-0 border-t border-line p-3">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} maxLength={500} placeholder="Reply to viewers" aria-label="Reply to viewers" className="input h-9" />
      </div>
    </>
  );
}

const time = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const day = (iso) => new Date(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

// Workspace chat. Messages arrive through Supabase Realtime (subscribed in EditorPage).
export default function ChatPanel({ workspaceId, userId, people }) {
  const messages = useEditorStore((s) => s.messages);
  const addMessage = useEditorStore((s) => s.addMessage);
  const spectators = useEditorStore((s) => s.spectators);
  const viewerCount = useEditorStore((s) => s.viewerChat.length);
  const [room, setRoom] = useState('team');
  const [body, setBody] = useState('');
  const list = useRef(null);
  const names = people.map((p) => p.name);
  const personOf = (id) => people.find((p) => p.id === id) || { name: 'Someone' };

  // Stay pinned to the newest message
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = async () => {
    const text = body.trim();
    if (!text) return;
    setBody('');
    const { data, error } = await supabase.from('messages').insert({ workspace_id: workspaceId, user_id: userId, body: text }).select().single();
    if (error) {
      setBody(text);
      return toast(`Message not sent: ${error.message}`, { tone: 'error' });
    }
    addMessage(data, false);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-line pl-4 pr-2">
        <h2 className="text-label-md text-ink">Chat</h2>
        {(spectators > 0 || viewerCount > 0) && (
          <ToggleGroup
            label="Chat with"
            size="sm"
            value={room}
            onChange={setRoom}
            className="!h-7"
            options={[{ id: 'team', label: 'Team' }, { id: 'viewers', label: `Viewers · ${spectators}` }]}
          />
        )}
      </div>
      {room === 'viewers' ? <ViewerChat workspaceId={workspaceId} /> : (
      <>
      <ol ref={list} className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3" aria-live="polite">
        {messages.length === 0 && (
          <li className="px-2 py-8 text-center">
            <GoCommentDiscussion size={20} className="mx-auto text-ink-subtle" aria-hidden="true" />
            <p className="mt-3 text-body-sm text-ink-muted">Say hello. Type @ to mention someone.</p>
          </li>
        )}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const newDay = !prev || day(prev.created_at) !== day(m.created_at);
          // Consecutive messages from one person within five minutes share a header
          const grouped = !newDay && prev?.user_id === m.user_id && new Date(m.created_at) - new Date(prev.created_at) < 300_000;
          const person = personOf(m.user_id);
          return (
            <li key={m.id}>
              {newDay && <p className="my-3 text-center text-label-sm text-ink-subtle">{day(m.created_at)}</p>}
              <div className={`flex gap-2.5 ${grouped ? '' : 'pt-2'}`}>
                {grouped ? <span className="w-6 shrink-0" /> : <Avatar name={person.name} id={m.user_id} src={person.avatar_url} size={24} />}
                <div className="min-w-0 flex-1">
                  {!grouped && (
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-label-md text-ink">{m.user_id === userId ? 'You' : person.name}</span>
                      <span className="shrink-0 text-label-sm text-ink-subtle">{time(m.created_at)}</span>
                    </div>
                  )}
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-body-sm text-ink">{withMentions(m.body, names)}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="shrink-0 border-t border-line p-3">
        <MentionTextarea value={body} onChange={setBody} onSubmit={send} people={people} placeholder="Message (Enter to send)" label="Message" />
      </div>
      </>
      )}
    </div>
  );
}
