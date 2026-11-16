import { forwardRef } from 'react';
import LoadingSpinner from './LoadingSpinner';

const VARIANTS = { primary: 'btn-primary', secondary: 'btn-secondary', ghost: 'btn-ghost', danger: 'btn-danger' };
const SIZES = { sm: 'btn-sm', md: 'btn-md', lg: 'btn-lg' };

const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, disabled, type = 'button', className = '', children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`btn ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {loading && <LoadingSpinner size="sm" />}
      {children}
    </button>
  );
});

export default Button;
