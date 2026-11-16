import { useEffect, useMemo, useRef, useState } from 'react';
import { GoBroadcast, GoEye } from 'react-icons/go';
import useEditorStore from '../../store/editorStore';
import { socketService } from '../../services/socketService';
import CodeEditor from '../editor/CodeEditor';
import SuggestModal from '../editor/SuggestModal';
import LangDot from '../ui/LangDot';
import Avatar from '../ui/Avatar';
import { languageForFile } from '../../lib/languages';

const guestName = () => {
  try {
    let name = localStorage.getItem('devsync:guest-name');
    if (!name) {
      name = `Guest ${Math.floor(1000 + Math.random() * 9000)}`;
      localStorage.setItem('devsync:guest-name', name);
    }
    return name;
  } catch {
    return 'Guest';
  }
};

// Watch a public workspace live: the real editor, read-only, following whoever is coding.
// data: the public API response. compact: embed layout (no chat). initialPath: file to start on.
export default function LiveView({ token, data, compact = false, initialPath, children }) {
  const { files, activeFileId, openFile, presence, spectators, viewerChat } = useEditorStore();
  const [live, setLive] = useState(false);
  const [following, setFollowing] = useState(!initialPath);
  const [suggesting, setSuggesting] = useState(null);
  const [message, setMessage] = useState('');
  const chatEnd = useRef(null);

  // Load the snapshot into the store, then go live over a spectator connection
  useEffect(() => {
    const store = useEditorStore.getState();
    store.reset();
    useEditorStore.setState({ files: data.files });
    const first = data.files.find((f) => f.path === initialPath)
      || data.files.find((f) => /readme\.md$/i.test(f.name))
      || data.files.find((f) => !f.is_folder);
    socketService.connect(data.workspace.id, {
      onConnection: (c) => setLive(c === 'online'),
      onFileStatus: store.setFileStatus,
      onText: store.setFileContent,
      onPresence: store.setPresence,
      onEvent: (event, payload) => {
        if (event === 'spectators') store.setSpectators(payload.count);
        if (event === 'spectate:chat') store.addViewerChat(payload);
      },
    }, { token, name: guestName() });
    if (first) store.openFile(first);
    return () => socketService.disconnect();
  }, [token]);

  // Follow the host (the owner if they're here, else whoever is) from file to file
  const host = presence.find((u) => u.id === data.workspace.owner_id) || presence[0];
  useEffect(() => {
    if (!following || !host?.fileId || host.fileId === activeFileId) return;
    const file = files.find((f) => f.id === host.fileId);
    if (file) openFile(file);
  }, [following, host?.fileId]);

  useEffect(() => { chatEnd.current?.scrollIntoView({ block: 'end' }); }, [viewerChat.length]); // braces: newer browsers return a promise here

  // Right-click > Suggest a change works here too; it goes through the socket
  useEffect(() => {
    const onAction = ({ detail }) => detail.type === 'suggest' && setSuggesting(detail);
    window.addEventListener('devsync:action', onAction);
    return () => window.removeEventListener('devsync:action', onAction);
  }, []);

  const list = useMemo(() => files.filter((f) => !f.is_folder).sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true })), [files]);
  const send = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    socketService.socket?.emit('spectate:chat', { workspaceId: data.workspace.id, text: message });
    setMessage('');
  };
  const sendSuggestion = (row) => new Promise((resolve) => {
    socketService.socket?.timeout(10_000).emit('spectate:suggest', {
      fileId: row.file_id, anchorStart: row.anchor_start, anchorEnd: row.anchor_end, line: row.line,
      original: row.original, replacement: row.replacement, note: row.note,
    }, (err, res) => resolve(err ? { error: 'Connection lost' } : res));
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <nav aria-label="Files" className={`shrink-0 overflow-y-auto border-b border-line bg-canvas-subtle p-2 md:border-b-0 md:border-r ${compact ? 'max-h-24 md:max-h-none md:w-48' : 'max-h-40 md:max-h-none md:w-60'}`}>
        <div className="mb-2 flex items-center gap-2 px-2 pt-1 text-label-sm text-ink-muted">
          {live ? (
            <span className="inline-flex items-center gap-1.5 text-brand-fg"><GoBroadcast size={12} aria-hidden="true" /> Live</span>
          ) : <span>Snapshot</span>}
          {spectators > 0 && <span className="inline-flex items-center gap-1"><GoEye size={12} aria-hidden="true" /> {spectators}</span>}
          {presence.length > 0 && (
            <span className="ml-auto flex -space-x-1">
              {presence.slice(0, 3).map((u) => <Avatar key={u.id} name={u.display_name || 'Someone'} id={u.id} src={u.avatar_url} size={18} ring />)}
            </span>
          )}
        </div>
        <ul>
          {list.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => { setFollowing(false); openFile(f); }}
                aria-current={f.id === activeFileId || undefined}
                className={`flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-body-sm ${f.id === activeFileId ? 'bg-brand-soft font-medium text-ink' : 'text-ink-muted hover:bg-canvas-muted hover:text-ink'}`}
              >
                <LangDot language={f.language || languageForFile(f.name)} />
                <span className="truncate">{f.path.slice(1)}</span>
                {presence.some((u) => u.fileId === f.id) && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-brand" title="Someone is here" />}
              </button>
            </li>
          ))}
        </ul>
        {!following && host && (
          <button type="button" onClick={() => setFollowing(true)} className="mt-2 w-full rounded-md px-2 py-1.5 text-left text-label-sm text-brand-fg hover:bg-canvas-muted">
            Follow {host.display_name || 'the host'} again
          </button>
        )}
      </nav>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          {activeFileId && <CodeEditor fileId={activeFileId} readOnly />}
        </div>
        {children}
      </main>

      {!compact && (
        <aside aria-label="Viewer chat" className="flex h-72 shrink-0 flex-col border-t border-line md:h-auto md:w-72 md:border-l md:border-t-0">
          <div className="flex h-10 shrink-0 items-center border-b border-line px-3 text-label-md text-ink">Live chat</div>
          <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 text-body-sm">
            {viewerChat.length === 0 && <li className="text-ink-muted">Say hi to the people coding. Right-click the code to suggest a change.</li>}
            {viewerChat.map((m, i) => (
              <li key={i}>
                <span className={`font-medium ${m.host ? 'text-brand-fg' : 'text-ink'}`}>{m.name}{m.host ? ' (coding)' : ''}</span>{' '}
                <span className="whitespace-pre-wrap break-words text-ink-muted">{m.text}</span>
              </li>
            ))}
            <li ref={chatEnd} />
          </ol>
          <form onSubmit={send} className="shrink-0 border-t border-line p-2">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={500}
              disabled={!live}
              placeholder={live ? 'Message everyone' : 'Chat opens when live'}
              aria-label="Chat message"
              className="input h-9"
            />
          </form>
        </aside>
      )}
      <SuggestModal request={suggesting} onClose={() => setSuggesting(null)} workspaceId={data.workspace.id} userId={null} onSend={sendSuggestion} />
    </div>
  );
}
