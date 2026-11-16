import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { GoX } from 'react-icons/go';

const SIZES = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-6xl' };
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({ isOpen, onClose, title, description, footer, size = 'md', children }) {
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const panel = panelRef.current;
    const returnFocus = document.activeElement;
    // Land keyboard users on the first field, else the first control, else the dialog
    (panel.querySelector('input:not([type="hidden"]):not(.sr-only), textarea') || panel.querySelector(FOCUSABLE) || panel).focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      // Keep Tab cycling inside the dialog
      const items = [...panel.querySelectorAll(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      returnFocus?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 animate-fade-in bg-[#1F2328]/40 dark:bg-black/60" onClick={() => closeRef.current()} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`relative flex max-h-[calc(100vh-2rem)] w-full ${SIZES[size]} animate-scale-in flex-col rounded-xl border border-line bg-canvas shadow-overlay focus:outline-none`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-headline-sm font-semibold text-ink">{title}</h2>
            {description && (
              <p id={descriptionId} className="mt-1.5 text-body-sm text-ink-muted">{description}</p>
            )}
          </div>
          <button type="button" onClick={() => closeRef.current()} className="icon-btn -mr-2 -mt-1" aria-label="Close dialog">
            <GoX size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 rounded-b-xl border-t border-line bg-canvas-subtle px-6 py-3">{footer}</div>
        )}
      </div>
    </div>,
    document.body
  );
}
