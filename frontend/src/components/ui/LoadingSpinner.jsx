export default function LoadingSpinner({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16',
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className={`relative ${sizes[size]}`}>
        <div className={`absolute inset-0 rounded-full border-2 border-surface-700`} />
        <div className={`absolute inset-0 rounded-full border-2 border-transparent border-t-brand-500 animate-spin`} />
      </div>
    </div>
  );
}
