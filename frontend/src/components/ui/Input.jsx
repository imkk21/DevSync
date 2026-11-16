import { forwardRef, useId } from 'react';

const Input = forwardRef(function Input(
  { label, hint, error, icon: Icon, size = 'md', id, className = '', ...props },
  ref
) {
  const autoId = useId();
  const inputId = id || autoId;
  const messageId = `${inputId}-message`;

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-label-md text-ink">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon
            aria-hidden="true"
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
          />
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? messageId : undefined}
          className={`input ${size === 'lg' ? 'input-lg' : ''} ${Icon ? 'pl-9' : ''} ${error ? 'input-error' : ''} ${className}`}
          {...props}
        />
      </div>
      {(error || hint) && (
        <p id={messageId} className={`text-body-sm ${error ? 'text-danger' : 'text-ink-muted'}`}>
          {error || hint}
        </p>
      )}
    </div>
  );
});

export default Input;
