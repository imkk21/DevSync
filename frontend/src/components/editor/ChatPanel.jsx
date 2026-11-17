import { useEffect, useRef, useState } from 'react';
import { GoCommentDiscussion } from 'react-icons/go';
import { supabase } from '../../lib/supabase';
import useEditorStore from '../../store/editorStore';
import { toast } from '../../store/toastStore';
import Avatar from '../ui/Avatar';
import MentionTextarea, { withMentions } from '../ui/MentionTextarea';
import ToggleGroup from '../ui/ToggleGroup';
import { socketService } from '../../services/socketService';
import { usePolls, PollComposer, PollCard } from './Polls';
import { GoGraph, GoDeviceCameraVideo } from 'react-icons/go';
import { VideoRecorder, VideoAttachment } from './VideoMessage';

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
export default function ChatPanel({ workspaceId, userId, people, canEdit }) {
  const { polls, setPolls, votes, setVotes } = usePolls(workspaceId);
  const [composing, setComposing] = useState(false);
  const [recording, setRecording] = useState(false);
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
  }, [messages.length, polls.length]);

  const vote = async (poll, choice) => {
    setVotes((v) => [...v.filter((x) => !(x.poll_id === poll.id && x.user_id === userId)), { poll_id: poll.id, user_id: userId, choice }]);
    const { error } = await supabase.from('poll_votes').upsert({ poll_id: poll.id, user_id: userId, workspace_id: workspaceId, choice });
    if (error) toast(error.message, { tone: 'error' });
  };
  const closePoll = async (poll) => {
    setPolls((list) => list.map((p) => (p.id === poll.id ? { ...p, closed: true } : p)));
    const { error } = await supabase.from('polls').update({ closed: true }).eq('id', poll.id);
    if (error) toast(error.message, { tone: 'error' });
  };
  // Messages and polls in one timeline
  const feed = [...messages, ...polls.map((p) => ({ ...p, poll: true, user_id: p.created_by }))].sort((a, b) => a.created_at.localeCompare(b.created_at));

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
        {feed.length === 0 && (
          <li className="px-2 py-8 text-center">
            <GoCommentDiscussion size={20} className="mx-auto text-ink-subtle" aria-hidden="true" />
            <p className="mt-3 text-body-sm text-ink-muted">Say hello. Type @ to mention someone.</p>
          </li>
        )}
        {feed.map((m, i) => {
          const prev = feed[i - 1];
          const newDay = !prev || day(prev.created_at) !== day(m.created_at);
          // Consecutive messages from one person within five minutes share a header
          const grouped = !newDay && !m.poll && !prev?.poll && prev?.user_id === m.user_id && new Date(m.created_at) - new Date(prev.created_at) < 300_000;
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
                  {m.poll ? (
                    <div className="mt-1.5">
                      <PollCard poll={m} votes={votes} userId={userId} canClose={canEdit} onVote={vote} onClose={closePoll} />
                    </div>
                  ) : (
                    <>
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-body-sm text-ink">{withMentions(m.body, names)}</p>
                      {m.attachment?.kind === 'video' && <VideoAttachment attachment={m.attachment} />}
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="shrink-0 border-t border-line p-3">
        <MentionTextarea value={body} onChange={setBody} onSubmit={send} people={people} placeholder="Message (Enter to send)" label="Message" />
        {canEdit && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <button type="button" onClick={() => setComposing(true)} className="inline-flex items-center gap-1.5 text-label-sm text-ink-muted hover:text-ink">
              <GoGraph size={12} aria-hidden="true" /> New poll or quiz
            </button>
            <button type="button" onClick={() => setRecording(true)} className="inline-flex items-center gap-1.5 text-label-sm text-ink-muted hover:text-ink">
              <GoDeviceCameraVideo size={12} aria-hidden="true" /> Video message
            </button>
          </div>
        )}
      </div>
      <VideoRecorder isOpen={recording} onClose={() => setRecording(false)} workspaceId={workspaceId} userId={userId} onSent={(m) => addMessage(m, false)} />
      <PollComposer isOpen={composing} onClose={() => setComposing(false)} workspaceId={workspaceId} userId={userId} onCreated={(p) => setPolls((list) => [...list.filter((x) => x.id !== p.id), p])} />
      </>
      )}
    </div>
  );
}
