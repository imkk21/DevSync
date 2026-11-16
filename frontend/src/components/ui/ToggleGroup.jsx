// Segmented control: a row of pressed/unpressed buttons sharing one border
export default function ToggleGroup({ label, options, value, onChange, size = 'md', stretch = false, className = '' }) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`inline-flex shrink-0 rounded-md border border-line-strong bg-canvas-subtle p-[3px] ${size === 'sm' ? 'h-8' : 'h-10'} ${className}`}
    >
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={active}
            aria-label={o.ariaLabel}
            title={o.ariaLabel}
            onClick={() => onChange(o.id)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-[4px] px-3 text-label-md transition-colors ${stretch ? 'flex-1' : ''} ${
              active ? 'bg-canvas text-ink shadow-[0_0_0_1px_rgb(var(--line-strong))]' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
