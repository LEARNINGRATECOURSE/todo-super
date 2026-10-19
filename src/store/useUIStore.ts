import { create } from 'zustand';
import { todayStr } from '../lib/dates';

export type TabId = 'today' | 'calendar' | 'workout' | 'habits' | 'more';
export type ModalName =
  | 'task' | 'habit' | 'routine' | 'exercisePicker' | 'activeWorkout' | 'plate' | 'programs' | 'body' | 'achievements'
  | 'note' | 'widget' | 'settings' | 'workoutSummary' | 'sessionDetail' | 'projects' | 'oneRm';

export interface ModalEntry { id: number; name: ModalName; props?: Record<string, unknown> }
export interface Toast { id: number; message: string; tone?: 'info' | 'success' | 'warn'; actionLabel?: string; onAction?: () => void }

interface UIState {
  tab: TabId;
  selectedDate: string;
  modals: ModalEntry[];
  toasts: Toast[];
  anchor: { habitId: string; text: string } | null;
  setTab: (t: TabId) => void;
  setDate: (d: string) => void;
  open: (name: ModalName, props?: Record<string, unknown>) => void;
  close: (name?: ModalName) => void;
  toast: (message: string, opts?: Partial<Omit<Toast, 'id' | 'message'>>) => void;
  dismissToast: (id: number) => void;
  setAnchor: (a: UIState['anchor']) => void;
}

let seq = 1;
const initialTab = (): TabId => {
  try {
    const t = new URLSearchParams(location.search).get('tab') as TabId | null;
    if (t && ['today', 'calendar', 'workout', 'habits', 'more'].includes(t)) return t;
    const saved = sessionStorage.getItem('tf.tab') as TabId | null;
    if (saved) return saved;
  } catch { /* ignore */ }
  return 'today';
};

export const useUIStore = create<UIState>((set, get) => ({
  tab: initialTab(),
  selectedDate: todayStr(),
  modals: [],
  toasts: [],
  anchor: null,
  setTab: (tab) => {
    try { sessionStorage.setItem('tf.tab', tab); } catch { /* ignore */ }
    set({ tab });
  },
  setDate: (selectedDate) => set({ selectedDate }),
  open: (name, props) => set((s) => ({ modals: [...s.modals, { id: seq++, name, props }] })),
  close: (name) =>
    set((s) => {
      if (!s.modals.length) return s;
      if (!name) return { modals: s.modals.slice(0, -1) };
      const idx = [...s.modals].reverse().findIndex((m) => m.name === name);
      if (idx < 0) return s;
      const real = s.modals.length - 1 - idx;
      return { modals: s.modals.filter((_, i) => i !== real) };
    }),
  toast: (message, opts) => {
    const id = seq++;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, message, tone: 'info', ...opts }] }));
    setTimeout(() => get().dismissToast(id), opts?.actionLabel ? 6000 : 3200);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setAnchor: (anchor) => {
    set({ anchor });
    if (anchor) setTimeout(() => get().anchor === anchor && set({ anchor: null }), 8000);
  },
}));
