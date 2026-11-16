// Live extras drawn on top of a Monaco editor: who wrote each line, pings, ink, reactions,
// paste highlights and the "someone else is in this function" warning.
// Each attach* function returns a cleanup.
import { toneIndex } from '../components/ui/Avatar';
import { enclosingBlock } from './workspaceFiles';

// A person's colour as a CSS colour string (follows light/dark theme)
export const toneColor = (userId, alpha = 1) => {
  const rgb = getComputedStyle(document.documentElement).getPropertyValue(`--tone-${toneIndex(userId)}-fg`).trim();
  return `rgb(${rgb} / ${alpha})`;
};

// Gutter bar on each line in the colour of whoever wrote most of it
export function attachAuthorship(editor, monaco, session, nameOf) {
  const decorations = editor.createDecorationsCollection();
  let timer = 0;
  const render = () => {
    const model = editor.getModel();
    if (!model) return;
    const lineCount = model.getLineCount();
    const items = [];
    session.lineAuthors().forEach((user, i) => {
      if (!user || i >= lineCount) return;
      items.push({
        range: new monaco.Range(i + 1, 1, i + 1, 1),
        options: { linesDecorationsClassName: `author-bar author-tone-${toneIndex(user)}`, linesDecorationsTooltip: `Written by ${nameOf(user)}` },
      });
    });
    decorations.set(items);
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(render, 250);
  };
  const off = session.on((type) => ['text', 'authors', 'synced'].includes(type) && schedule());
  render();
  return () => {
    clearTimeout(timer);
    off();
    decorations.clear();
  };
}

// A short highlight that draws everyone's eyes to a line
export function pulseLine(editor, monaco, line) {
  const model = editor.getModel();
  if (!model) return;
  const n = Math.min(Math.max(1, line), model.getLineCount());
  const decorations = editor.createDecorationsCollection([{ range: new monaco.Range(n, 1, n, 1), options: { isWholeLine: true, className: 'ping-line' } }]);
  editor.revealLineInCenterIfOutsideViewport(n);
  setTimeout(() => decorations.clear(), 2600);
}

const FADE_AFTER = 2500; // ms a finished stroke stays before fading
const FADE_FOR = 800;

// Freehand ink over the code. Points are stored in lines and character columns, not pixels,
// so strokes land on the same code for everyone whatever their font size or scroll position.
// send(data) broadcasts; receive(from, data) draws someone else's stroke; setDrawing(on) toggles input.
export function attachInk(editor, monaco, { send, myColor }) {
  const host = editor.getDomNode();
  const canvas = document.createElement('canvas');
  canvas.className = 'ink-layer';
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const strokes = new Map(); // key -> { points: [[col, line]], color, doneAt }
  let frame = 0;
  let drawing = false;
  let mine = null; // { key, id, pending: [] }
  let flushTimer = 0;
  let seq = 0;

  const metrics = () => {
    const font = editor.getOption(monaco.editor.EditorOption.fontInfo);
    return {
      charW: font.typicalHalfwidthCharacterWidth,
      lineH: editor.getOption(monaco.editor.EditorOption.lineHeight),
      left: editor.getLayoutInfo().contentLeft,
      scrollLeft: editor.getScrollLeft(),
      scrollTop: editor.getScrollTop(),
    };
  };

  const resize = () => {
    const { width, height } = editor.getLayoutInfo();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    schedule();
  };

  const draw = () => {
    frame = 0;
    const { width, height } = editor.getLayoutInfo();
    ctx.clearRect(0, 0, width, height);
    const m = metrics();
    const now = Date.now();
    for (const [key, s] of strokes) {
      const alpha = s.doneAt ? 1 - Math.max(0, now - s.doneAt - FADE_AFTER) / FADE_FOR : 1;
      if (alpha <= 0) {
        strokes.delete(key);
        continue;
      }
      ctx.strokeStyle = s.color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      s.points.forEach(([col, line], i) => {
        const x = m.left + col * m.charW - m.scrollLeft;
        const y = line * m.lineH - m.scrollTop;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (strokes.size) schedule();
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(draw);
  };

  const toUnits = (e) => {
    const rect = host.getBoundingClientRect();
    const m = metrics();
    return [
      +((e.clientX - rect.left - m.left + m.scrollLeft) / m.charW).toFixed(2),
      +((e.clientY - rect.top + m.scrollTop) / m.lineH).toFixed(2),
    ];
  };
  const flush = (done = false) => {
    clearTimeout(flushTimer);
    flushTimer = 0;
    if (!mine) return;
    send({ id: mine.id, points: mine.pending, color: myColor, done });
    mine.pending = [];
    if (done) mine = null;
  };

  const onDown = (e) => {
    if (!drawing || e.button !== 0) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const id = `${Date.now().toString(36)}${seq++}`;
    const point = toUnits(e);
    mine = { key: `me:${id}`, id, pending: [point] };
    strokes.set(mine.key, { points: [point], color: myColor, doneAt: null });
    schedule();
  };
  const onMove = (e) => {
    if (!mine) return;
    const point = toUnits(e);
    strokes.get(mine.key)?.points.push(point);
    mine.pending.push(point);
    if (!flushTimer) flushTimer = setTimeout(flush, 40);
    schedule();
  };
  const onUp = () => {
    if (!mine) return;
    const s = strokes.get(mine.key);
    if (s) s.doneAt = Date.now();
    flush(true);
    schedule();
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  const subs = [editor.onDidLayoutChange(resize), editor.onDidScrollChange(schedule)];
  resize();

  return {
    setDrawing(on) {
      drawing = on;
      canvas.classList.toggle('ink-active', on);
    },
    receive(fromSocket, { id, points, color, done }) {
      const key = `${fromSocket}:${id}`;
      const s = strokes.get(key) || { points: [], color, doneAt: null };
      s.points.push(...(points || []).slice(0, 500));
      if (done) s.doneAt = Date.now();
      strokes.set(key, s);
      schedule();
    },
    dispose() {
      cancelAnimationFrame(frame);
      clearTimeout(flushTimer);
      subs.forEach((s) => s.dispose());
      canvas.remove();
    },
  };
}

// Emoji counts at the end of each line that has reactions. The text comes from a CSS class per
// label (like the cursor name tags), which renders reliably where injected text doesn't.
const labelStyle = typeof document !== 'undefined' ? document.createElement('style') : null;
const labelClass = new Map(); // label -> class
function classForLabel(label) {
  if (!labelClass.has(label)) {
    labelClass.set(label, `rx-${labelClass.size}`);
    labelStyle.textContent = [...labelClass].map(([text, cls]) => `.${cls}::after{content:${JSON.stringify(text)}}`).join('');
    if (!labelStyle.isConnected) document.head.appendChild(labelStyle);
  }
  return labelClass.get(label);
}

export function reactionDecorations(monaco, model, rows, lineOf) {
  const byLine = new Map();
  for (const r of rows) {
    const line = Math.min(lineOf(r), model.getLineCount());
    const counts = byLine.get(line) || new Map();
    counts.set(r.emoji, (counts.get(r.emoji) || 0) + 1);
    byLine.set(line, counts);
  }
  return [...byLine].map(([line, counts]) => {
    const end = model.getLineMaxColumn(line);
    return {
      range: new monaco.Range(line, end, line, end),
      options: {
        afterContentClassName: `reaction-chip ${classForLabel([...counts].map(([emoji, n]) => `${emoji} ${n}`).join('   '))}`,
        stickiness: 1,
      },
    };
  });
}

// "Maya is also editing greet()": people whose cursor moved in the last ACTIVE_MS inside the
// same function you're typing in. Returns [{ name, users: [display names] }] or [].
const ACTIVE_MS = 20_000;
export function overlaps(model, session, myLine, lastTypedAt) {
  if (Date.now() - lastTypedAt > ACTIVE_MS) return null;
  const lines = model.getLinesContent();
  const mine = enclosingBlock(lines, myLine - 1);
  if (!mine) return null;
  const users = new Set();
  for (const c of session.resolveCursors()) {
    if (Date.now() - c.at > ACTIVE_MS) continue;
    const theirs = enclosingBlock(lines, model.getPositionAt(c.head).lineNumber - 1);
    if (theirs && theirs.line === mine.line) users.add(c.user.display_name || 'Someone');
  }
  return users.size ? { name: mine.name, users: [...users] } : null;
}
