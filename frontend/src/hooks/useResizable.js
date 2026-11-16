import { useRef, useState } from 'react';

// A draggable panel edge. `direction` is 1 when dragging right/down grows the panel, -1 otherwise.
// The size is remembered per `storageKey`. Arrow keys resize too; double-click resets.
export default function useResizable({ storageKey, initial, min, max, axis = 'x', direction = 1 }) {
  const clamp = (v) => Math.min(max, Math.max(min, v));
  const [size, setSize] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(storageKey));
      return saved ? clamp(saved) : initial;
    } catch {
      return initial;
    }
  });
  const latest = useRef(size);
  latest.current = size;

  const commit = (v) => {
    setSize(v);
    try { localStorage.setItem(storageKey, String(v)); } catch { /* storage unavailable */ }
  };

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const start = axis === 'x' ? e.clientX : e.clientY;
    const startSize = latest.current;
    const cursor = axis === 'x' ? 'col-resize' : 'row-resize';
    document.body.style.cursor = cursor;
    document.body.style.userSelect = 'none';

    const move = (ev) => setSize(clamp(startSize + ((axis === 'x' ? ev.clientX : ev.clientY) - start) * direction));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      commit(latest.current);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onKeyDown = (e) => {
    const grow = axis === 'x' ? { ArrowRight: 1, ArrowLeft: -1 } : { ArrowDown: 1, ArrowUp: -1 };
    if (!(e.key in grow)) return;
    e.preventDefault();
    commit(clamp(latest.current + grow[e.key] * direction * 16));
  };

  return {
    size,
    handleProps: {
      role: 'separator',
      tabIndex: 0,
      'aria-orientation': axis === 'x' ? 'vertical' : 'horizontal',
      'aria-valuenow': Math.round(size),
      'aria-valuemin': min,
      'aria-valuemax': max,
      onPointerDown,
      onKeyDown,
      onDoubleClick: () => commit(initial),
    },
  };
}
