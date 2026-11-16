import { GoAlert, GoCheckCircle, GoInfo, GoX } from 'react-icons/go';
import useToastStore from '../../store/toastStore';

const ICONS = { info: GoInfo, success: GoCheckCircle, error: GoAlert };
const TONE = { info: 'text-ink-muted', success: 'text-brand-fg', error: 'text-danger' };

export default function Toaster() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[min(360px,calc(100vw-32px))] flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICONS[t.tone];
        return (
          <div key={t.id} role={t.tone === 'error' ? 'alert' : 'status'} className="menu pointer-events-auto flex animate-fade-up items-start gap-2.5 px-3 py-2.5">
            <Icon size={16} className={`mt-0.5 shrink-0 ${TONE[t.tone]}`} aria-hidden="true" />
            <p className="min-w-0 flex-1 text-body-sm text-ink">{t.message}</p>
            {t.action && (
              <button
                type="button"
                onClick={() => { t.action.onClick(); dismiss(t.id); }}
                className="shrink-0 text-label-md text-brand-fg hover:underline"
              >
                {t.action.label}
              </button>
            )}
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="-mr-1 shrink-0 rounded p-0.5 text-ink-subtle hover:text-ink">
              <GoX size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
