// Whiteboard files (.board): one drawing element per line, "<id>\t<json>".
// Two people changing different shapes touch different lines, so edits merge cleanly. If the same
// shape is changed at once, both lines survive the merge and the higher Excalidraw `version` wins.

export function parseBoard(text) {
  const latest = new Map();
  for (const line of text.split('\n')) {
    const tab = line.indexOf('\t');
    if (tab < 1) continue;
    try {
      const el = JSON.parse(line.slice(tab + 1));
      const prev = latest.get(el.id);
      if (!prev || (el.version ?? 0) > (prev.version ?? 0) || ((el.version ?? 0) === (prev.version ?? 0) && (el.versionNonce ?? 0) > (prev.versionNonce ?? 0))) {
        latest.set(el.id, el);
      }
    } catch {
      // A line half-merged from two simultaneous edits: skip it, the other copy wins
    }
  }
  return [...latest.values()];
}

export const boardLine = (el) => `${el.id}\t${JSON.stringify(el)}`;

// Edits that turn `text` into a board where each element in `changed` replaces its old line(s):
// [{ index, remove, insert }] applied from last to first
export function boardEdits(text, changed) {
  const ids = new Set(changed.map((el) => el.id));
  const edits = [];
  let offset = 0;
  for (const line of text.split('\n')) {
    const end = offset + line.length + 1; // includes the newline
    const tab = line.indexOf('\t');
    if (tab > 0 && ids.has(line.slice(0, tab))) edits.push({ index: offset, remove: Math.min(end, text.length) - offset, insert: '' });
    offset = end;
  }
  edits.reverse();
  const tail = text.length - edits.reduce((n, e) => n + e.remove, 0);
  const needsNewline = tail > 0 && !text.endsWith('\n') && !edits.some((e) => e.index + e.remove >= text.length);
  edits.push({ index: text.length, remove: 0, insert: `${needsNewline ? '\n' : ''}${changed.map(boardLine).join('\n')}\n`, append: true });
  return edits;
}

// Apply boardEdits to a plain string (used by tests; the editor applies them to Y.Text)
export function applyEdits(text, edits) {
  let out = text;
  for (const e of edits) {
    const at = e.append ? out.length : e.index;
    out = out.slice(0, at) + e.insert + out.slice(at + e.remove);
  }
  return out;
}
