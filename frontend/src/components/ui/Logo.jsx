// DevSync mark: two opposing arrows (sync) on the brand green
export function LogoMark({ size = 28, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 text-brand ${className}`}
    >
      <rect width="32" height="32" rx="7" fill="currentColor" />
      <path
        d="M9 12.5h12.5M18 9l3.5 3.5L18 16M23 19.5H10.5M14 16l-3.5 3.5L14 23"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Logo({ size = 28, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <span className="text-[19px] font-semibold tracking-[-0.01em] text-ink">DevSync</span>
    </span>
  );
}
