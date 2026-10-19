import { create } from 'zustand';
import { chime, playAmbient, stopAmbient, type Soundscape } from '../lib/audio';
import { haptic } from '../lib/util';
import { notify } from '../lib/notifications';
import { logPomodoro } from '../repo/pomodoroRepository';
import { evaluateAchievements } from '../repo/workoutRepository';
import { useUIStore } from './useUIStore';

export type PomodoroMode = '25/5' | '50/10' | '90/20';
export const MODES: Record<PomodoroMode, { work: number; brk: number; label: string }> = {
  '25/5': { work: 25, brk: 5, label: 'Standard' },
  '50/10': { work: 50, brk: 10, label: 'Deep Work' },
  '90/20': { work: 90, brk: 20, label: 'Ultradian' },
};
const KEY = 'taskflow.pomodoro';

interface PState {
  mode: PomodoroMode; phase: 'work' | 'break'; running: boolean; endsAt: number | null; remaining: number;
  taskId: string | null; taskTitle: string | null; sound: Soundscape; volume: number;
  setMode: (m: PomodoroMode) => void;
  start: () => void; pause: () => void; reset: () => void; skip: () => void; complete: () => void;
  link: (id: string | null, title?: string | null) => void;
  setSound: (s: Soundscape) => void; setVolume: (v: number) => void;
}

const phaseSeconds = (mode: PomodoroMode, phase: 'work' | 'break') => (phase === 'work' ? MODES[mode].work : MODES[mode].brk) * 60;
type Persisted = Pick<PState, 'mode' | 'phase' | 'running' | 'endsAt' | 'remaining' | 'taskId' | 'taskTitle' | 'sound' | 'volume'>;
const load = (): Persisted => {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Persisted | null;
    if (p) return p;
  } catch { /* ignore */ }
  return { mode: '25/5', phase: 'work', running: false, endsAt: null, remaining: 25 * 60, taskId: null, taskTitle: null, sound: 'rain', volume: 0.5 };
};

export const usePomodoroStore = create<PState>((set, get) => {
  const save = () => {
    const { mode, phase, running, endsAt, remaining, taskId, taskTitle, sound, volume } = get();
    try { localStorage.setItem(KEY, JSON.stringify({ mode, phase, running, endsAt, remaining, taskId, taskTitle, sound, volume })); } catch { /* ignore */ }
  };
  const patch = (p: Partial<PState>) => { set(p); save(); };
  return {
    ...load(),
    // Segmented fires onChange even for the active option; re-selecting it must not reset a running session.
    setMode: (mode) => { if (mode !== get().mode) patch({ mode, phase: 'work', running: false, endsAt: null, remaining: phaseSeconds(mode, 'work') }); },
    start: () => {
      const { remaining } = get();
      patch({ running: true, endsAt: Date.now() + remaining * 1000 });
    },
    pause: () => {
      const { endsAt } = get();
      patch({ running: false, remaining: endsAt ? Math.max(1, Math.ceil((endsAt - Date.now()) / 1000)) : get().remaining, endsAt: null });
    },
    reset: () => patch({ running: false, endsAt: null, phase: 'work', remaining: phaseSeconds(get().mode, 'work') }),
    skip: () => {
      const { phase, mode } = get();
      const next = phase === 'work' ? 'break' : 'work';
      patch({ phase: next, running: false, endsAt: null, remaining: phaseSeconds(mode, next) });
    },
    complete: () => {
      const { phase, mode, taskId, taskTitle } = get();
      logPomodoro({ durationMinutes: phase === 'work' ? MODES[mode].work : MODES[mode].brk, type: phase, taskId, taskTitle });
      chime('complete');
      haptic([200, 100, 200]);
      const msg = phase === 'work' ? 'Focus session complete — take a break.' : 'Break over — ready to focus?';
      useUIStore.getState().toast(msg, { tone: 'success' });
      if (document.visibilityState === 'hidden') void notify(phase === 'work' ? 'Focus complete' : 'Break over', msg, 'pomodoro');
      for (const a of evaluateAchievements()) useUIStore.getState().toast(`🏆 Achievement unlocked: ${a.title}`, { tone: 'success' });
      const next = phase === 'work' ? 'break' : 'work';
      patch({ phase: next, running: false, endsAt: null, remaining: phaseSeconds(mode, next) });
    },
    link: (taskId, taskTitle = null) => patch({ taskId, taskTitle }),
    setSound: (sound) => patch({ sound }),
    setVolume: (volume) => patch({ volume }),
  };
});

/** Ambient audio plays only while a focus phase is running. */
export function syncAmbient() {
  const { running, phase, sound, volume } = usePomodoroStore.getState();
  if (running && phase === 'work' && sound !== 'mute') playAmbient(sound, volume);
  else stopAmbient();
}
