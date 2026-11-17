import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const EDITOR_DEFAULTS = {
  fontSize: 14,
  tabSize: 2,
  wordWrap: false,
  minimap: false,
  lineNumbers: true,
  formatOnSave: false,
  vim: false,
  authorship: false, // colour each line by who wrote it
  highlightPastes: false, // always on in interviews and classroom copies
};

// App-wide accessibility (Settings > Accessibility). Not touched by "Reset to defaults".
export const A11Y_DEFAULTS = {
  announce: true, // read out joins, leaves, driver changes and pings to screen readers
  readableFont: false, // Atkinson Hyperlegible
  highContrast: false,
  textScale: 100, // percent
  reduceMotion: false,
};

// Editor preferences, remembered in this browser
const useSettingsStore = create(
  persist(
    (set) => ({
      ...EDITOR_DEFAULTS,
      ...A11Y_DEFAULTS,
      update: (patch) => set(patch),
      resetEditor: () => set(EDITOR_DEFAULTS),
    }),
    { name: 'devsync:editor-settings' },
  ),
);

export default useSettingsStore;
