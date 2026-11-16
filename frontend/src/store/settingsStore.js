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
