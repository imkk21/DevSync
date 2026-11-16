import { create } from 'zustand';

// Theme preference: 'light' | 'dark' | 'system'. index.html applies it before
// first paint; this store keeps it in sync afterwards.
const KEY = 'devsync:theme';
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

function readPreference() {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch {
    return 'system';
  }
}

const resolve = (theme) => (theme === 'system' ? (systemDark.matches ? 'dark' : 'light') : theme);

function apply(resolved) {
  const root = document.documentElement;
  if (root.classList.contains('dark') === (resolved === 'dark')) return;
  // Switch instantly instead of animating every colour transition on the page
  const freeze = document.createElement('style');
  freeze.textContent = '*,*::before,*::after{transition:none!important}';
  document.head.appendChild(freeze);
  root.classList.toggle('dark', resolved === 'dark');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#0D1110' : '#FFFFFF');
  getComputedStyle(document.body).opacity; // flush styles before re-enabling transitions
  setTimeout(() => freeze.remove(), 0);
}

const initial = readPreference();

const useThemeStore = create((set) => ({
  theme: initial,
  resolved: resolve(initial),
  setTheme: (theme) => {
    try {
      if (theme === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, theme);
    } catch {
      /* storage unavailable: still switch for this session */
    }
    const resolved = resolve(theme);
    apply(resolved);
    set({ theme, resolved });
  },
}));

// Follow the OS when the preference is "system"
systemDark.addEventListener('change', () => {
  if (useThemeStore.getState().theme !== 'system') return;
  const resolved = resolve('system');
  apply(resolved);
  useThemeStore.setState({ resolved });
});

apply(useThemeStore.getState().resolved);

export default useThemeStore;
