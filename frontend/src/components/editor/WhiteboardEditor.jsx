import { useEffect, useMemo, useRef, useState } from 'react';
import { Excalidraw, restoreElements } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import useThemeStore from '../../store/themeStore';
import useEditorStore from '../../store/editorStore';
import useAuthStore from '../../store/authStore';
import { socketService } from '../../services/socketService';
import { LOCAL } from '../../lib/collab';
import { parseBoard, boardEdits } from '../../lib/board';
import { toneColor } from '../../lib/editorExtras';
import LoadingSpinner from '../ui/LoadingSpinner';

const WRITE_DELAY = 120; // ms: Excalidraw reports every pointer move; batch them
// Shapes come from other people's browsers: let Excalidraw validate and repair them first, so one
// odd shape can never break the board for everyone
const attempt = (list) => {
  try {
    return restoreElements(list, null, { repairBindings: true });
  } catch {
    return null;
  }
};
const safe = (elements) => attempt(elements)
  // A broken stacking-order key rejects the whole board: drop the keys and let Excalidraw renumber
  ?? attempt(elements.map(({ index, ...el }) => el))
  // Last resort: keep every shape that can be repaired on its own
  ?? elements.flatMap((el) => attempt([el]) ?? []);
const POINTER_EVERY = 80;

// A .board file as a live whiteboard: shapes sync through the file's shared document, pointers
// through signals. Loaded on its own (Excalidraw is large).
export default function WhiteboardEditor({ fileId, readOnly }) {
  const theme = useThemeStore((s) => s.resolved);
  const status = useEditorStore((s) => s.fileStatus[fileId]);
  const presence = useEditorStore((s) => s.presence);
  const me = useAuthStore((s) => s.user);
  const [api, setApi] = useState(null);
  const [initial, setInitial] = useState(null);
  const synced = useRef(new Map()); // id -> version written to / read from the document
  const applying = useRef(false);
  const writeTimer = useRef(0);
  const lastPointer = useRef(0);
  const pointers = useRef(new Map()); // socketId -> collaborator
  const session = useMemo(() => socketService.collab?.open(fileId), [fileId]);

  // First load: the board as it is in the shared document
  useEffect(() => {
    let alive = true;
    setInitial(null);
    session?.ready.then(() => {
      if (!alive) return;
      const elements = safe(parseBoard(session.text.toString()));
      synced.current = new Map(elements.map((el) => [el.id, el.version]));
      setInitial({ elements, appState: { viewBackgroundColor: 'transparent' } });
    });
    return () => { alive = false; };
  }, [session]);

  // Someone else drew: merge their newer shapes into the canvas
  useEffect(() => {
    if (!api || !session) return;
    const onRemote = (event, tr) => {
      if (tr.origin === LOCAL) return;
      const remote = safe(parseBoard(session.text.toString()));
      const local = new Map(api.getSceneElementsIncludingDeleted().map((el) => [el.id, el]));
      let changed = false;
      for (const el of remote) {
        const mine = local.get(el.id);
        if (!mine || el.version > mine.version) {
          local.set(el.id, el);
          changed = true;
        }
        synced.current.set(el.id, Math.max(synced.current.get(el.id) ?? 0, el.version));
      }
      if (!changed) return;
      applying.current = true;
      try {
        api.updateScene({ elements: [...local.values()] });
      } catch (err) {
        console.error('Whiteboard update skipped:', err.message);
      } finally {
        applying.current = false;
      }
    };
    session.text.observe(onRemote);
    return () => session.text.unobserve(onRemote);
  }, [api, session]);

  // Collaborators' pointers
  useEffect(() => {
    if (!api) return;
    const onSignal = ({ detail: { type, data, from } }) => {
      if (type !== 'board' || data?.fileId !== fileId) return;
      pointers.current.set(from.socketId, {
        pointer: { x: data.x, y: data.y, tool: 'pointer' },
        username: from.display_name || 'Someone',
        color: { background: toneColor(from.id), stroke: toneColor(from.id) },
        id: from.id,
      });
      api.updateScene({ collaborators: new Map(pointers.current) });
    };
    window.addEventListener('devsync:signal', onSignal);
    return () => window.removeEventListener('devsync:signal', onSignal);
  }, [api, fileId]);

  // People who left the workspace drop off the canvas
  useEffect(() => {
    if (!api) return;
    const online = new Set(presence.map((u) => u.id));
    let removed = false;
    for (const [key, c] of pointers.current) {
      if (!online.has(c.id)) {
        pointers.current.delete(key);
        removed = true;
      }
    }
    if (removed) api.updateScene({ collaborators: new Map(pointers.current) });
  }, [api, presence]);

  useEffect(() => () => clearTimeout(writeTimer.current), []);

  // My drawing: write shapes whose version moved past what the document has
  const onChange = (elements) => {
    if (applying.current || readOnly || !session?.synced) return;
    clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => {
      const changed = elements.filter((el) => (synced.current.get(el.id) ?? -1) < el.version);
      if (!changed.length) return;
      const edits = boardEdits(session.text.toString(), changed);
      session.doc.transact(() => {
        for (const e of edits) {
          const at = e.append ? session.text.length : e.index;
          if (e.remove) session.text.delete(at, e.remove);
          if (e.insert) session.text.insert(at, e.insert);
        }
      }, LOCAL);
      for (const el of changed) synced.current.set(el.id, el.version);
    }, WRITE_DELAY);
  };

  const onPointerUpdate = ({ pointer }) => {
    const now = Date.now();
    if (now - lastPointer.current < POINTER_EVERY) return;
    lastPointer.current = now;
    socketService.collab?.signal('board', { fileId, x: Math.round(pointer.x), y: Math.round(pointer.y) });
  };

  if (!initial || status === 'loading') {
    return <div className="flex h-full items-center justify-center bg-canvas"><LoadingSpinner size="lg" className="text-brand" /></div>;
  }

  return (
    <div className="h-full w-full" data-testid="whiteboard">
      <Excalidraw
        key={fileId}
        excalidrawAPI={setApi}
        initialData={initial}
        onChange={onChange}
        onPointerUpdate={onPointerUpdate}
        viewModeEnabled={readOnly}
        theme={theme}
        name={me?.email}
        UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, export: { saveFileToDisk: true } }, tools: { image: false } }}
      />
    </div>
  );
}
