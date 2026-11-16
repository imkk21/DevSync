import { GoAlert, GoCheckCircle } from 'react-icons/go';

const TONES = {
  error: { cls: 'border-danger/25 bg-danger-soft text-danger', Icon: GoAlert, role: 'alert' },
  success: { cls: 'border-brand/25 bg-brand-soft text-brand-fg', Icon: GoCheckCircle, role: 'status' },
};

export default function Alert({ tone = 'error', children, className = '' }) {
  const { cls, Icon, role } = TONES[tone];
  return (
    <div role={role} className={`flex items-start gap-2 rounded-md border px-3 py-2.5 text-body-sm ${cls} ${className}`}>
      <Icon className="mt-0.5 shrink-0" size={14} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
