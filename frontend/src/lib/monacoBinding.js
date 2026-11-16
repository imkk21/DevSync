// Two-way link between a Monaco model and a FileSession's Y.Text, plus remote cursors.
import { LOCAL } from './collab';
import { toneIndex } from '../components/ui/Avatar';

// Model <-> text. One per open file; lives as long as the tab.
export function bindModel(session, model, monaco) {
  let muted = false;
  const quietly = (fn) => {
    if (muted) return;
    muted = true;
    try { fn(); } finally { muted = false; }
  };

  quietly(() => {
    model.setEOL(monaco.editor.EndOfLineSequence.LF);
    if (model.getValue() !== session.text.toString()) model.setValue(session.text.toString());
  });

  // Text -> model. Delta offsets refer to the old text, which is what applyEdits expects for a batch.
  const onText = (event, tr) => quietly(() => {
    const edits = [];
    let index = 0;
    for (const op of event.delta) {
      if (op.retain) index += op.retain;
      else if (op.insert) {
        const at = model.getPositionAt(index);
        edits.push({ range: new monaco.Range(at.lineNumber, at.column, at.lineNumber, at.column), text: op.insert });
      } else if (op.delete) {
        const from = model.getPositionAt(index);
        const to = model.getPositionAt(index + op.delete);
        edits.push({ range: new monaco.Range(from.lineNumber, from.column, to.lineNumber, to.column), text: '' });
        index += op.delete;
      }
    }
    model.applyEdits(edits);
    // After undo/redo, put the caret where the change happened
    // (the first edit's start is the same before and after the batch)
    if (tr.origin === session.undo && binding.editor?.getModel() === model && edits.length) {
      const [first] = edits;
      const pos = model.getPositionAt(model.getOffsetAt(first.range.getStartPosition()) + first.text.length);
      binding.editor.setPosition(pos);
      binding.editor.revealPositionInCenterIfOutsideViewport(pos);
    }
  });
  let text = session.text;
  text.observe(onText);
  // A rebuilt session (refused edit) has a new document: show the server's text and follow that one
  const offSession = session.on((type) => {
    if (type === 'reset') {
      text?.unobserve(onText);
      text = null;
    } else if (type === 'synced' && !text) {
      text = session.text;
      quietly(() => model.setValue(text.toString()));
      text.observe(onText);
    }
  });

  // Model -> text. Changes in one event are applied from the end so earlier offsets stay valid.
  const sub = model.onDidChangeContent((e) => quietly(() => {
    if (!text) return; // resyncing after a refused edit
    session.doc.transact(() => {
      for (const c of [...e.changes].sort((x, y) => y.rangeOffset - x.rangeOffset)) {
        if (c.rangeLength) session.text.delete(c.rangeOffset, c.rangeLength);
        if (c.text) session.text.insert(c.rangeOffset, c.text);
      }
    }, LOCAL);
  }));

  const binding = {
    editor: null,
    destroy() {
      text?.unobserve(onText);
      offSession();
      sub.dispose();
    },
  };
  return binding;
}

// Remote cursors and selections for whichever session the editor is showing.
const styleEl = typeof document !== 'undefined' ? document.createElement('style') : null;
const cursorClass = new Map(); // socketId -> short class suffix
const cursorCss = new Map(); // suffix -> css rules

function classFor(socketId, user) {
  let key = cursorClass.get(socketId);
  if (!key) {
    key = `u${cursorClass.size}`;
    cursorClass.set(socketId, key);
  }
  if (!cursorCss.has(key)) {
    const tone = toneIndex(user.id);
    const name = JSON.stringify(user.display_name || 'Someone').slice(1, -1).replace(/[<>]/g, '');
    cursorCss.set(key, `
.rc-caret-${key}{--rc:rgb(var(--tone-${tone}-fg))}
.rc-sel-${key}{background:rgb(var(--tone-${tone}-fg) / .22)}
.rc-caret-${key}::after{content:"${name}"}`);
    styleEl.textContent = [...cursorCss.values()].join('');
    if (!styleEl.isConnected) document.head.appendChild(styleEl);
  }
  return key;
}

const LABEL_MS = 2500; // name tags show while someone moves, then fade so they don't cover code

// `following()` returns the user id this editor should keep in view, if any (follow mode)
export function showRemoteCursors(editor, session, monaco, following = () => null) {
  const decorations = editor.createDecorationsCollection();
  let frame = 0;
  let fadeTimer = 0;
  let followedAt = 0;

  const render = () => {
    frame = 0;
    clearTimeout(fadeTimer);
    const model = editor.getModel();
    if (!model) return;
    const items = [];
    const now = Date.now();
    let nextFade = Infinity;
    for (const c of session.resolveCursors()) {
      const idle = now - c.at > LABEL_MS;
      if (!idle) nextFade = Math.min(nextFade, c.at + LABEL_MS - now);
      const key = classFor(c.socketId, c.user);
      const head = model.getPositionAt(c.head);
      const anchor = model.getPositionAt(c.anchor);
      if (c.user.id === following() && c.at > followedAt) {
        followedAt = c.at;
        editor.revealPositionInCenterIfOutsideViewport(head);
      }
      if (c.anchor !== c.head) {
        const [from, to] = c.anchor < c.head ? [anchor, head] : [head, anchor];
        items.push({
          range: new monaco.Range(from.lineNumber, from.column, to.lineNumber, to.column),
          options: { className: `rc-sel-${key}`, stickiness: 1 },
        });
      }
      items.push({
        range: new monaco.Range(head.lineNumber, head.column, head.lineNumber, head.column),
        options: {
          beforeContentClassName: `rc-caret rc-caret-${key}${head.lineNumber === 1 ? ' rc-below' : ''}${idle ? ' rc-idle' : ''}`,
          stickiness: 1,
          hoverMessage: { value: c.user.display_name || 'Someone' },
        },
      });
    }
    decorations.set(items);
    if (nextFade !== Infinity) fadeTimer = setTimeout(render, nextFade + 20);
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(render); };

  const off = session.on((type) => (type === 'cursors' || type === 'text') && schedule());
  const cursorSub = editor.onDidChangeCursorSelection((e) => {
    const model = editor.getModel();
    if (!model) return;
    const sel = e.selection;
    session.setCursor(
      model.getOffsetAt({ lineNumber: sel.selectionStartLineNumber, column: sel.selectionStartColumn }),
      model.getOffsetAt({ lineNumber: sel.positionLineNumber, column: sel.positionColumn }),
    );
  });
  render();

  return () => {
    cancelAnimationFrame(frame);
    clearTimeout(fadeTimer);
    off();
    cursorSub.dispose();
    decorations.clear();
  };
}
