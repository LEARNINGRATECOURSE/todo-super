import type { Habit, Task, WorkoutSession } from '../db/types';
import { diffDays, fmtDuration, minToTime, nowTimeStr, timeToMin, todayStr } from './dates';
import { isScheduledOn, slotsFor } from '../repo/habitRepository';
import type { Planned } from '../repo/workoutRepository';

export type WorkoutState = 'active' | 'done' | 'planned' | 'skipped' | 'rest';
export type TLItem =
  | { kind: 'task'; key: string; start: number | null; end: number | null; task: Task; overdue?: boolean }
  | { kind: 'workout'; key: string; start: number; end: number; state: WorkoutState; planned?: Planned; sessions: WorkoutSession[] }
  | { kind: 'habit'; key: string; start: number | null; end: number | null; habit: Habit; slot: string | null }
  | { kind: 'free'; key: string; minutes: number; start: number }
  | { kind: 'now'; key: string; label: string; start: number };

export interface TimelineInput {
  date: string;
  tasks: Task[];
  habits: Habit[];
  sessions: WorkoutSession[];
  planned: Planned;
  workoutActive: boolean;
  workoutTime: string;
  now?: Date;
}
export interface TimelineModel { allDay: TLItem[]; timed: TLItem[]; workoutState: WorkoutState }

const MIN_FREE = 15;
const OVERDUE_DAYS = 14;

export function buildTimeline(i: TimelineInput): TimelineModel {
  const today = todayStr();
  const isToday = i.date === today;
  const allDay: TLItem[] = [];
  const timed: (TLItem & { start: number })[] = [];

  // tasks
  for (const t of i.tasks) {
    if (t.status === 'archived') continue;
    const overdue = isToday && t.dueDate < i.date && !t.completed && diffDays(i.date, t.dueDate) <= OVERDUE_DAYS;
    if (t.dueDate !== i.date && !overdue) continue;
    const s = t.startTime ?? t.dueTime;
    if (!s || overdue) {
      allDay.push({ kind: 'task', key: t.id, start: null, end: null, task: t, overdue });
      continue;
    }
    const start = timeToMin(s);
    const end = t.endTime ? timeToMin(t.endTime) : start + (t.estimatedMinutes || 30);
    timed.push({ kind: 'task', key: t.id, start, end: Math.max(end, start + 5), task: t });
  }

  // habits
  for (const h of i.habits) {
    if (h.archived || !isScheduledOn(h, i.date)) continue;
    const slots = slotsFor(h);
    if (slots.length) {
      slots.forEach((slot) => { const start = timeToMin(slot); timed.push({ kind: 'habit', key: `${h.id}@${slot}`, start, end: start + 10, habit: h, slot }); });
    } else if (h.reminderTime) {
      const start = timeToMin(h.reminderTime);
      timed.push({ kind: 'habit', key: h.id, start, end: start + 10, habit: h, slot: null });
    } else allDay.push({ kind: 'habit', key: h.id, start: null, end: null, habit: h, slot: null });
  }

  // workout
  const done = i.sessions.filter((s) => s.date === i.date);
  let workoutState: WorkoutState = 'rest';
  if (i.workoutActive && isToday) workoutState = 'active';
  else if (done.length) workoutState = 'done';
  else if (i.planned.status === 'planned') workoutState = 'planned';
  else if (i.planned.status === 'skipped') workoutState = 'skipped';
  if (workoutState !== 'rest') {
    const startIso = done[0]?.startedAt;
    let start = timeToMin(i.workoutTime);
    if (workoutState === 'done' && startIso) { const d = new Date(startIso); start = d.getHours() * 60 + d.getMinutes(); }
    const dur = workoutState === 'done' ? Math.max(15, Math.round(done.reduce((a, s) => a + s.duration, 0) / 60)) : 60;
    timed.push({ kind: 'workout', key: 'workout', start, end: start + dur, state: workoutState, planned: i.planned, sessions: done });
  }

  timed.sort((a, b) => a.start - b.start || (a.kind === 'workout' ? -1 : 0));

  // free-time gaps between consecutive blocks (>= 15 minutes)
  const out: TLItem[] = [];
  let cursorEnd: number | null = null;
  for (const it of timed) {
    if (cursorEnd !== null && it.start - cursorEnd >= MIN_FREE) {
      out.push({ kind: 'free', key: `free-${cursorEnd}`, minutes: it.start - cursorEnd, start: cursorEnd });
    }
    out.push(it);
    const end = 'end' in it && it.end != null ? it.end : it.start;
    cursorEnd = cursorEnd === null ? end : Math.max(cursorEnd, end);
  }

  // live "now" marker goes right after the last block that has already started
  if (isToday) {
    const nowMin = timeToMin(nowTimeStr());
    let at = 0;
    out.forEach((it, idx) => { if (it.kind !== 'free' && it.start != null && it.start <= nowMin) at = idx + 1; });
    out.splice(at, 0, { kind: 'now', key: 'now', label: nowTimeStr(), start: nowMin });
  }
  return { allDay, timed: out, workoutState };
}

export const freeLabel = (min: number) => `${fmtDuration(min)} Free time`;
export const slotLabel = (m: number) => minToTime(m);
