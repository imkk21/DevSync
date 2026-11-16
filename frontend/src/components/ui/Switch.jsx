import { useId } from 'react';

// On/off setting with a label and optional hint. Native checkbox underneath, so it's keyboard and form friendly.
export default function Switch({ label, hint, checked, onChange, disabled = false }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-label-md text-ink">{label}</span>
        {hint && <span className="mt-1 block text-body-sm text-ink-muted">{hint}</span>}
      </label>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer h-5 w-9 cursor-pointer appearance-none rounded-full border border-line-strong bg-canvas-muted transition-colors checked:border-brand checked:bg-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-[3px] top-[3px] h-3.5 w-3.5 rounded-full bg-canvas shadow-sm ring-1 ring-black/10 transition-transform peer-checked:translate-x-4"
        />
      </span>
    </div>
  );
}
