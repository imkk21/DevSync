const SIZES = { sm: 14, md: 20, lg: 28 };

// Decorative; announce loading with PageLoader or aria-busy on the owner.
export default function LoadingSpinner({ size = 'md', className = '' }) {
  const px = SIZES[size];
  return (
    <svg width={px} height={px} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`shrink-0 animate-spin ${className}`}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div role="status" className="flex h-screen flex-col items-center justify-center gap-3 bg-canvas">
      <LoadingSpinner size="lg" className="text-brand" />
      <span className="text-body-sm text-ink-muted">{label}</span>
    </div>
  );
}
