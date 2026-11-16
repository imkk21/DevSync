import { useState } from 'react';

// Each person gets a stable tone from their id: [background, text] colours.
// The six tones are CSS variables (index.css), so they adapt to dark mode.
const TONE_COUNT = 6;

export function toneIndex(key = '') {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(hash) % TONE_COUNT;
}

export function toneFor(key = '') {
  const n = toneIndex(key);
  return [`rgb(var(--tone-${n}-bg))`, `rgb(var(--tone-${n}-fg))`];
}

// Two letters when there's room; one when avatars are small enough to overlap in a stack
function initials(name, count) {
  const parts = name.split('@')[0].split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] || '?') + (count > 1 ? parts[1]?.[0] || '' : '')).toUpperCase();
}

export default function Avatar({ name = '', id, src, size = 28, ring = false, title, className = '' }) {
  const [broken, setBroken] = useState(false);
  const [bg, fg] = toneFor(id || name);
  const a11y = title ? { role: 'img', 'aria-label': title, title } : { 'aria-hidden': true };
  const base = `inline-flex shrink-0 items-center justify-center rounded-full ${ring ? 'ring-2 ring-canvas' : ''} ${className}`;

  if (src && !broken) {
    return (
      <img
        src={src}
        alt=""
        {...a11y}
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className={`${base} bg-canvas-muted object-cover`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      {...a11y}
      className={`${base} select-none font-semibold`}
      style={{ width: size, height: size, backgroundColor: bg, color: fg, fontSize: Math.max(10, Math.round(size * 0.4)) }}
    >
      {initials(name || '?', size >= 30 ? 2 : 1)}
    </span>
  );
}
