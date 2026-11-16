import { useRef, useState } from 'react';
import { GoCheck, GoDeviceDesktop, GoMoon, GoSun } from 'react-icons/go';
import useThemeStore from '../../store/themeStore';
import useDismiss from '../../hooks/useDismiss';
import ToggleGroup from './ToggleGroup';

const OPTIONS = [
  { id: 'light', label: 'Light', Icon: GoSun },
  { id: 'dark', label: 'Dark', Icon: GoMoon },
  { id: 'system', label: 'System', Icon: GoDeviceDesktop },
];

// Compact icon button with a Light / Dark / System menu
export default function ThemeMenu({ className = '' }) {
  const { theme, resolved, setTheme } = useThemeStore();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useDismiss(ref, open, () => setOpen(false));
  const Current = resolved === 'dark' ? GoMoon : GoSun;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Change theme"
        title="Theme"
        className="icon-btn"
      >
        <Current size={16} />
      </button>
      {open && (
        <div role="menu" aria-label="Theme" className="menu absolute right-0 top-full z-50 mt-2 w-40 origin-top-right animate-scale-in">
          {OPTIONS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="menuitemradio"
              aria-checked={theme === id}
              onClick={() => { setTheme(id); setOpen(false); }}
              className="menu-item"
            >
              <Icon size={16} className="text-ink-muted" aria-hidden="true" />
              {label}
              {theme === id && <GoCheck size={16} className="ml-auto text-brand-fg" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Full-width segmented version for mobile menus
export function ThemeSwitcher({ className = '' }) {
  const { theme, setTheme } = useThemeStore();
  return (
    <ToggleGroup
      label="Theme"
      value={theme}
      onChange={setTheme}
      stretch
      className={className}
      options={OPTIONS.map(({ id, label, Icon }) => ({ id, label, icon: <Icon size={14} aria-hidden="true" /> }))}
    />
  );
}
