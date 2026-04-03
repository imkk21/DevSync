import { forwardRef } from 'react';

const variants = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 font-medium px-6 py-2.5 rounded-lg transition-all duration-200 active:scale-[0.98]',
};

const sizes = {
  sm: 'text-xs px-3 py-1.5',
  md: 'text-sm px-6 py-2.5',
  lg: 'text-base px-8 py-3',
};

const Button = forwardRef(({ children, variant = 'primary', size = 'md', className = '', disabled, loading, ...props }, ref) => {
  return (
    <button
      ref={ref}
      className={`${variants[variant]} ${sizes[size]} inline-flex items-center justify-center gap-2 ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
});

Button.displayName = 'Button';
export default Button;
