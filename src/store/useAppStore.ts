import { create } from 'zustand';
import { db } from '../db/database';
import type { Habit, HabitLog, Note, PomodoroSession, Project, Subtask, Task } from '../db/types';
import { chime } from '../lib/audio';
import { haptic } from '../lib/util';
import type { Unit } from '../lib/units';
import { checkinsOf, createHabit, deleteHabit, freezeDay, logFor, setHabitValue, slotsFor, toggleBoolean, toggleSlot, unfreezeDay } from '../repo/habitRepository';
import { deleteTask, restoreTask, subtasksOf, toggleComplete } from '../repo/taskRepository';
import { evaluateAchievements } from '../repo/workoutRepository';
import { getSetting, setSetting } from '../repo/settings';
import { useUIStore } from './useUIStore';

interface AppState {
  tasks: Task[]; subtasks: Subtask[]; projects: Project[]; habits: Habit[]; habitLogs: HabitLog[]; notes: Note[];
  pomodoros: PomodoroSession[]; settings: Record<string, string>;
  sync: () => void;
  toggleTask: (id: string) => void;
  removeTasks: (ids: string[]) => void;
  completeTasks: (ids: string[]) => void;
  habitToggle: (habitId: string, date: string) => void;
  habitSlot: (habitId: string, date: string, slot: string) => void;
  habitSet: (habitId: string, date: string, value: number) => void;
  habitFreeze: (habitId: string, date: string) => void;
  removeHabit: (id: string) => void;
  set: (key: string, value: string) => void;
}

const snapshot = () => ({
  // archived tasks stay in the database (and backups) but are hidden from every view
  tasks: db.all('tasks').filter((t) => t.status !== 'archived'), subtasks: [...db.all('subtasks')], projects: [...db.all('projects')], habits: [...db.all('habits')],
  habitLogs: [...db.all('habit_logs')], notes: [...db.all('notes')], pomodoros: [...db.all('pomodoro_sessions')],
  settings: Object.fromEntries(db.all('app_settings').map((s) => [s.key, s.value])),
});

const ui = () => useUIStore.getState();

function afterHabitWrite(habitId: string, completedNow: boolean) {
  if (!completedNow) return;
  haptic([10, 40, 10]);
  const habit = db.get('habits', habitId);
  const next = habit?.chainedHabitId ? db.get('habits', habit.chainedHabitId) : undefined;
  if (next && !next.archived) ui().setAnchor({ habitId: next.id, text: `Routine Anchor: Next up is ${next.icon} ${next.name}!` });
  for (const a of evaluateAchievements()) ui().toast(`🏆 Achievement unlocked: ${a.title}`, { tone: 'success' });
}

export const useAppStore = create<AppState>((set) => ({
  ...snapshot(),
  sync: () => set(snapshot()),

  toggleTask: (id) => {
    const before = db.get('tasks', id);
    const { next } = toggleComplete(id);
    haptic(12);
    if (before && !before.completed) {
      chime('complete');
      ui().toast(next ? `Done — next "${before.title}" scheduled` : 'Task completed', { tone: 'success' });
    }
  },
  removeTasks: (ids) => {
    const removed = ids.flatMap((id) => {
      const t = db.get('tasks', id);
      return t ? [{ t, subs: subtasksOf(id) }] : [];
    });
    removed.forEach(({ t }) => deleteTask(t.id));
    ui().toast(`Deleted ${removed.length} task${removed.length === 1 ? '' : 's'}`, {
      actionLabel: 'Undo', onAction: () => removed.forEach(({ t, subs }) => restoreTask(t, subs)),
    });
  },
  completeTasks: (ids) => {
    ids.forEach((id) => { const t = db.get('tasks', id); if (t && !t.completed) toggleComplete(id); });
    ui().toast(`Completed ${ids.length} task${ids.length === 1 ? '' : 's'}`, { tone: 'success' });
  },

  habitToggle: (habitId, date) => {
    const h = db.get('habits', habitId);
    if (!h) return;
    const r = toggleBoolean(h, date);
    afterHabitWrite(habitId, r.completedNow);
  },
  habitSlot: (habitId, date, slot) => {
    const h = db.get('habits', habitId);
    if (!h) return;
    const r = toggleSlot(h, date, slot);
    afterHabitWrite(habitId, r.completedNow);
  },
  habitSet: (habitId, date, value) => {
    const h = db.get('habits', habitId);
    if (!h) return;
    const r = setHabitValue(h, date, value);
    afterHabitWrite(habitId, r.completedNow);
  },
  habitFreeze: (habitId, date) => {
    const h = db.get('habits', habitId);
    if (!h) return;
    const log = logFor(habitId, date);
    if (log?.isFrozen) { unfreezeDay(h, date); ui().toast('Freeze removed'); return; }
    if (freezeDay(h, date)) ui().toast('❄️ Streak frozen for today', { tone: 'success' });
    else ui().toast('No freezes left this month', { tone: 'warn' });
  },
  removeHabit: (id) => {
    deleteHabit(id);
  },
  set: (key, value) => setSetting(key, value),
}));

db.onChange(() => useAppStore.getState().sync());

export const useSetting = (key: string, fallback = '') => useAppStore((s) => s.settings[key] ?? fallback);
export const useUnit = (): Unit => (useAppStore((s) => s.settings.unit) === 'lb' ? 'lb' : 'kg');
export const setUnit = (u: Unit) => setSetting('unit', u);
export { createHabit, checkinsOf, slotsFor, getSetting };
