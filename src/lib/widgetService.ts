import { db } from '../db/database';
import { generateInsights } from './insightsEngine';
import { todayStr } from './dates';
import { activeRoutine, plannedFor, sessionOn } from '../repo/workoutRepository';
import { dayRate, isScheduledOn } from '../repo/habitRepository';
import { taskStart } from '../repo/taskRepository';

export interface WidgetData {
  generatedAt: string; date: string;
  tasks: { id: string; title: string; time: string | null; priority: string }[];
  tasksDone: number; tasksTotal: number;
  habits: { done: number; total: number; rate: number };
  workout: { status: 'done' | 'planned' | 'rest' | 'skipped'; routine: string | null; day: string | null };
  insight: string | null;
}
const KEY = 'widget-data.json';

export function buildWidgetData(): WidgetData {
  const date = todayStr();
  const todays = db.all('tasks').filter((t) => t.dueDate === date && t.status !== 'archived');
  const open = todays.filter((t) => !t.completed).sort((a, b) => (taskStart(a) ?? '99').localeCompare(taskStart(b) ?? '99'));
  const rate = dayRate(date);
  const r = activeRoutine();
  const planned = plannedFor(r?.id, date);
  const done = sessionOn(date).length > 0;
  const insights = generateInsights({
    tasks: db.all('tasks'), sessions: db.all('workout_sessions'), habits: db.all('habits'), habitLogs: db.all('habit_logs'),
    pomodoros: db.all('pomodoro_sessions'), isScheduled: isScheduledOn,
  });
  return {
    generatedAt: new Date().toISOString(), date,
    tasks: open.slice(0, 5).map((t) => ({ id: t.id, title: t.title, time: taskStart(t), priority: t.priority })),
    tasksDone: todays.length - open.length, tasksTotal: todays.length,
    habits: { ...rate, rate: rate.total ? Math.round((rate.done / rate.total) * 100) : 0 },
    workout: { status: done ? 'done' : planned.status === 'planned' ? 'planned' : planned.status === 'skipped' ? 'skipped' : 'rest', routine: r?.name ?? null, day: planned.day?.day.dayName ?? null },
    insight: insights[0]?.body ?? null,
  };
}

/** Writes the snapshot to the local "widget-data.json" slot (read by a future native widget / shortcut). */
export function writeWidgetData(): WidgetData {
  const data = buildWidgetData();
  try { localStorage.setItem(KEY, JSON.stringify(data, null, 2)); } catch { /* quota */ }
  return data;
}
export function downloadWidgetData() {
  const data = writeWidgetData();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = KEY;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
