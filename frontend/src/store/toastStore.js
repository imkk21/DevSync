import { create } from 'zustand';

let nextId = 1;

// Short-lived messages in the corner. tone: 'info' | 'success' | 'error'.
// action: { label, onClick } shows a button (e.g. "Open").
const useToastStore = create((set, get) => ({
  toasts: [],
  show: (message, { tone = 'info', action, duration = 4500 } = {}) => {
    const id = nextId++;
    set({ toasts: [...get().toasts.slice(-3), { id, message, tone, action }] });
    if (duration) setTimeout(() => get().dismiss(id), duration);
    return id;
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const toast = (message, options) => useToastStore.getState().show(message, options);
export default useToastStore;
