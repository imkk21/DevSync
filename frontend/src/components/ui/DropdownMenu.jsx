import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GoKebabHorizontal } from 'react-icons/go';
import useDismiss from '../../hooks/useDismiss';

const WIDTH = 192;
const GAP = 4;

// "⋯" button with a menu. items: [{ label, icon: Icon, onSelect, danger?, hidden? } | 'divider']
// The menu is portalled and positioned against the viewport, so scroll areas and cards never clip it.
export default function DropdownMenu({ items, label = 'More actions', align = 'right', className = '', buttonClassName = '' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const close = (refocus) => {
    setOpen(false);
    setPos(null);
    if (refocus) buttonRef.current?.focus();
  };
  useDismiss([buttonRef, menuRef], open, () => close(false));
  const visible = items.filter((i) => i && !i.hidden);

  // Below the button, or above it when there's no room; never off the sides
  useLayoutEffect(() => {
    if (!open) return;
    const r = buttonRef.current.getBoundingClientRect();
    const h = menuRef.current.offsetHeight;
    const top = r.bottom + GAP + h > window.innerHeight && r.top - GAP - h > 0 ? r.top - GAP - h : r.bottom + GAP;
    const left = Math.min(Math.max(8, align === 'right' ? r.right - WIDTH : r.left), window.innerWidth - WIDTH - 8);
    setPos({ top, left });
    menuRef.current.querySelector('[role="menuitem"]')?.focus({ preventScroll: true });
  }, [open, align]);

  // A fixed menu would drift away from its button on scroll, so close it instead
  useEffect(() => {
    if (!open) return;
    const onScroll = (e) => !menuRef.current?.contains(e.target) && close(false);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  const onKeyDown = (e) => {
    if (e.key === 'Escape' || e.key === 'Tab') {
      // Don't let Escape also close a dialog underneath
      e.stopPropagation();
      if (e.key === 'Escape') e.preventDefault();
      return close(true);
    }
    const buttons = [...menuRef.current.querySelectorAll('[role="menuitem"]')];
    const i = buttons.indexOf(document.activeElement);
    const next = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: buttons.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    buttons[(next + buttons.length) % buttons.length]?.focus();
  };

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); open ? close(false) : setOpen(true); }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        className={`icon-btn ${buttonClassName}`}
      >
        <GoKebabHorizontal size={16} />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          onKeyDown={onKeyDown}
          style={{ width: WIDTH, top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
          className="menu fixed z-[60] animate-scale-in"
        >
          {visible.map((item, i) =>
            item === 'divider' ? (
              <div key={`d${i}`} role="separator" className="my-1 h-px bg-line" />
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={(e) => { e.stopPropagation(); close(true); item.onSelect(); }}
                className={`menu-item ${item.danger ? 'menu-item-danger' : ''}`}
              >
                {item.icon && <item.icon size={16} className={item.danger ? '' : 'text-ink-muted'} aria-hidden="true" />}
                {item.label}
              </button>
            ),
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
