import { useEffect, useRef } from 'react';

// Calls onDismiss on a click outside `ref` (or every ref in an array) or on Escape, while `active`.
export default function useDismiss(ref, active, onDismiss) {
  const callback = useRef(onDismiss);
  callback.current = onDismiss;

  useEffect(() => {
    if (!active) return;
    const onPointer = (e) => {
      const refs = Array.isArray(ref) ? ref : [ref];
      if (!refs.some((r) => r.current?.contains(e.target))) callback.current();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') callback.current();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, active]);
}
