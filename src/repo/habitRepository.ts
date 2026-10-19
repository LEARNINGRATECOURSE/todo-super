import { db } from '../db/database';
import type { Habit, HabitLog, HabitStatus, ScheduleConfig } from '../db/types';
import { addDays, isWeekend, minToTime, timeToMin, todayStr, weekday } from '../lib/dates';
import { parseJSON, uid } from '../lib/util';

export const FREEZES_PER_MONTH = 2;

export const configOf = (h: Habit): ScheduleConfig => parseJSON<ScheduleConfig>(h.scheduleConfig, {});

/** Concrete check-in slot times ("HH:mm") for a habit, empty when it has no multi-checkin schedule. */
export function slotsFor(h: Habit): string[] {
  const cfg = configOf(h);
  // Check-ins are stored by time string, so duplicate times would make a slot impossible to complete.
  if (h.scheduleType === 'fixed') return [...new Set((cfg.fixedTimes ?? []).filter(Boolean))].sort();
  if (h.scheduleType === 'interval') {
    const step = Math.max(1, cfg.intervalHours ?? 2);
    const start = cfg.startHour ?? 8;
    const end = cfg.endHour ?? 22;
    const out: string[] = [];
    for (let m = start * 60; m <= end * 60; m += step * 60) out.push(minToTime(m));
    return out;
  }
  return [];
}

/** Habits with slots are completed when every slot is checked in; otherwise `target` applies. */
export const effectiveTarget = (h: Habit) => {
  const n = slotsFor(h).length;
  return n > 0 ? n : h.target;
};

export function isScheduledOn(h: Habit, date: string): boolean {
  if (h.frequency === 'weekdays') return !isWeekend(date);
  if (h.frequency === 'custom') {
    const days = configOf(h).customDays;
    return days?.length ? days.includes(weekday(date)) : true;
  }
  return true;
}

export const logFor = (habitId: string, date: string) => db.all('habit_logs').find((l) => l.habitId === habitId && l.date === date);
export const checkinsOf = (l?: HabitLog) => parseJSON<string[]>(l?.checkins, []);
export const frozenDatesOf = (h: Habit) => parseJSON<string[]>(h.frozenDates, []);

function writeLog(h: Habit, date: string, value: number, checkins: string[] | null, frozen = false): { log: HabitLog; completedNow: boolean; wasCompleted: boolean } {
  const existing = logFor(h.id, date);
  const wasCompleted = !!existing?.completed;
  const v = Math.max(0, value);
  const completed = !frozen && v >= effectiveTarget(h);
  const status: HabitStatus = frozen ? 'frozen' : completed ? 'full' : v > 0 ? 'partial' : 'missed';
  const log: HabitLog = {
    id: existing?.id ?? uid('l_'), habitId: h.id, date, value: v, completed: completed ? 1 : 0,
    checkins: checkins ? JSON.stringify(checkins) : existing?.checkins ?? null, status, isFrozen: frozen ? 1 : 0,
  };
  db.insert('habit_logs', log);
  return { log, completedNow: completed && !wasCompleted, wasCompleted };
}

export function setHabitValue(h: Habit, date: string, value: number) {
  const slots = slotsFor(h);
  // Plain (non-slotted) values keep any recorded check-in times.
  return writeLog(h, date, slots.length ? Math.min(value, slots.length) : value, null);
}

/** Toggle/record a check-in for a slot (or an ad-hoc time for boolean habits). */
export function toggleSlot(h: Habit, date: string, slot: string) {
  const log = logFor(h.id, date);
  const list = checkinsOf(log);
  const next = list.includes(slot) ? list.filter((s) => s !== slot) : [...list, slot].sort();
  return writeLog(h, date, next.length, next);
}

export function toggleBoolean(h: Habit, date: string) {
  const log = logFor(h.id, date);
  return writeLog(h, date, log?.completed ? 0 : 1, null);
}

export function freezeCount(h: Habit, date: string) {
  const month = date.slice(0, 7);
  return frozenDatesOf(h).filter((d) => d.startsWith(month)).length;
}
export const canFreeze = (h: Habit, date: string) => freezeCount(h, date) < FREEZES_PER_MONTH;

export function freezeDay(h: Habit, date: string): boolean {
  if (frozenDatesOf(h).includes(date)) return true;
  if (logFor(h.id, date)?.completed) return false; // freezing would erase a completed day
  if (!canFreeze(h, date)) return false;
  db.transaction(() => {
    db.update('habits', h.id, { frozenDates: JSON.stringify([...frozenDatesOf(h), date]) });
    writeLog(h, date, logFor(h.id, date)?.value ?? 0, null, true);
  });
  return true;
}
export function unfreezeDay(h: Habit, date: string) {
  db.transaction(() => {
    const fresh = db.get('habits', h.id) ?? h;
    db.update('habits', h.id, { frozenDates: JSON.stringify(frozenDatesOf(fresh).filter((d) => d !== date)) });
    // Freezing keeps the day's progress; restore it instead of zeroing the log.
    writeLog(fresh, date, logFor(h.id, date)?.value ?? 0, null, false);
  });
}

export interface Streak { current: number; best: number }
/** Streak over scheduled days; frozen days neither add to nor break it; today only counts once complete. */
export function streakOf(h: Habit, today = todayStr()): Streak {
  const logs = new Map(db.all('habit_logs').filter((l) => l.habitId === h.id).map((l) => [l.date, l]));
  const frozen = new Set(frozenDatesOf(h));
  const dates = [...logs.keys()].sort();
  const first = dates[0];
  if (!first) return { current: 0, best: 0 };
  let best = 0, run = 0;
  for (let d = first; d <= today; d = addDays(d, 1)) {
    if (!isScheduledOn(h, d)) continue;
    const l = logs.get(d);
    if (l?.completed) { run++; best = Math.max(best, run); }
    else if (frozen.has(d) || l?.isFrozen) continue;
    else if (d === today) continue; // today is still open
    else run = 0;
  }
  return { current: run, best };
}

export function createHabit(input: Partial<Habit> & { name: string }): Habit {
  const h: Habit = {
    id: uid('h_'), name: input.name.trim(), icon: input.icon ?? '💧', color: input.color ?? '#ff4757', type: input.type ?? 'boolean',
    target: input.target ?? 1, unit: input.unit ?? '', frequency: input.frequency ?? 'daily', reminderTime: input.reminderTime ?? null,
    archived: 0, scheduleType: input.scheduleType ?? 'none', scheduleConfig: input.scheduleConfig ?? null,
    chainedHabitId: input.chainedHabitId ?? null, frozenDates: '[]',
  };
  db.insert('habits', h);
  return h;
}
export function updateHabit(id: string, patch: Partial<Habit>) {
  db.transaction(() => {
    const h = db.update('habits', id, patch);
    if (!h) return;
    // Stored completion/status were derived under the old target and slots; re-derive them.
    const slots = new Set(slotsFor(h));
    const target = effectiveTarget(h);
    db.all('habit_logs').filter((l) => l.habitId === id).forEach((l) => {
      const kept = slots.size ? checkinsOf(l).filter((s) => slots.has(s)) : null;
      const value = kept ? kept.length : l.value;
      const completed = !l.isFrozen && value >= target;
      const status: HabitStatus = l.isFrozen ? 'frozen' : completed ? 'full' : value > 0 ? 'partial' : 'missed';
      db.update('habit_logs', l.id, { value, completed: completed ? 1 : 0, status, ...(kept ? { checkins: JSON.stringify(kept) } : {}) });
    });
  });
}
export const deleteHabit = (id: string) => {
  db.transaction(() => {
    db.all('habits').filter((h) => h.chainedHabitId === id).forEach((h) => db.update('habits', h.id, { chainedHabitId: null }));
    db.remove('habits', id);
  });
};
export const timeOfSlot = timeToMin;

/** Completion rate for a date across scheduled, non-archived habits (frozen days are excluded). */
export function dayRate(date: string): { done: number; total: number } {
  const habits = db.all('habits').filter((h) => !h.archived && isScheduledOn(h, date));
  let done = 0, total = 0;
  for (const h of habits) {
    const l = logFor(h.id, date);
    if (l?.isFrozen) continue;
    total++;
    if (l?.completed) done++;
  }
  return { done, total };
}
