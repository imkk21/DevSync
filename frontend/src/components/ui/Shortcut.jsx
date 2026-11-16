const platform = typeof navigator === 'undefined' ? '' : navigator.userAgentData?.platform || navigator.platform || '';
export const MOD = /mac|iphone|ipad/i.test(platform) ? '⌘' : 'Ctrl';

export default function Shortcut({ keys, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {keys.map((key) => (
        <kbd key={key} className="kbd">{key}</kbd>
      ))}
    </span>
  );
}
