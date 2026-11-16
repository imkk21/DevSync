import { merge } from 'node-diff3';

// Three-way merge of text: `base` is where both sides started. Edits that don't overlap combine;
// overlapping ones are a conflict (text then has <<<<<<< markers).
export function merge3(base, ours, theirs) {
  if (ours === theirs || theirs === base) return { text: ours, conflict: false };
  if (ours === base) return { text: theirs, conflict: false };
  const r = merge(ours.split('\n'), base.split('\n'), theirs.split('\n'));
  return { text: r.result.join('\n'), conflict: r.conflict };
}
