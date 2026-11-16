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

// Editor preferences, remembered in this browser
const useSettingsStore = create(
  persist(
    (set) => ({
      ...EDITOR_DEFAULTS,
      update: (patch) => set(patch),
      resetEditor: () => set(EDITOR_DEFAULTS),
    }),
    { name: 'devsync:editor-settings' },
  ),
);

export default useSettingsStore;
