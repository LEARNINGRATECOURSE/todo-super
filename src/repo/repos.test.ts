import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/database';
import { buildBackup, factoryReset, restoreBackup } from './backup';
import { createHabit, freezeDay, setHabitValue, slotsFor, streakOf, toggleSlot } from './habitRepository';
import { seedDefaults } from './seed';
import { createTask, deleteTask, subtasksOf, toggleComplete } from './taskRepository';
import { computeFatigue, plannedFor, saveRoutine, toggleSkip, evaluateAchievements, exerciseBests } from './workoutRepository';
import { generateInsights } from '../lib/insightsEngine';
import { addDays, todayStr } from '../lib/dates';
import { PROGRAMS } from '../data/programs';
import { importProgram } from './workoutRepository';
import { exerciseIdFor } from '../data/exercises';

beforeEach(() => { db.clear(); seedDefaults(); });

describe('tasks', () => {
  it('completing a recurring task spawns the next occurrence', () => {
    const t = createTask({ title: 'Standup', dueDate: '2026-10-23', recurringRule: 'weekdays' }, ['a', 'b']);
    const { next } = toggleComplete(t.id);
    expect(next?.dueDate).toBe('2026-10-26');
    expect(subtasksOf(next!.id).map((s) => s.title)).toEqual(['a', 'b']);
    expect(db.get('tasks', t.id)?.completed).toBe(1);
  });
  it('deleting a task cascades to subtasks', () => {
    const t = createTask({ title: 'x' }, ['s1', 's2']);
    expect(subtasksOf(t.id)).toHaveLength(2);
    deleteTask(t.id);
    expect(db.all('subtasks')).toHaveLength(0);
  });
});

describe('habits', () => {
  it('expands interval and fixed schedules into slots', () => {
    const interval = createHabit({ name: 'Water', scheduleType: 'interval', scheduleConfig: JSON.stringify({ intervalHours: 2, startHour: 8, endHour: 22 }) });
    expect(slotsFor(interval)).toEqual(['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00']);
    const fixed = createHabit({ name: 'Vit', scheduleType: 'fixed', scheduleConfig: JSON.stringify({ fixedTimes: ['13:00', '08:00'] }) });
    expect(slotsFor(fixed)).toEqual(['08:00', '13:00']);
  });
  it('slotted habits complete when every slot is checked', () => {
    const h = createHabit({ name: 'Vit', scheduleType: 'fixed', scheduleConfig: JSON.stringify({ fixedTimes: ['08:00', '20:00'] }) });
    expect(toggleSlot(h, '2026-03-10', '08:00').log.status).toBe('partial');
    const r = toggleSlot(h, '2026-03-10', '20:00');
    expect(r.log.status).toBe('full');
    expect(r.completedNow).toBe(true);
  });
  it('counter habits report partial then full', () => {
    const h = createHabit({ name: 'Water', type: 'counter', target: 8 });
    expect(setHabitValue(h, '2026-03-10', 3).log.status).toBe('partial');
    expect(setHabitValue(h, '2026-03-10', 8).log.status).toBe('full');
  });
  it('streak freezes protect streaks and are limited per month', () => {
    const h = createHabit({ name: 'Stretch' });
    setHabitValue(h, '2026-03-10', 1);
    setHabitValue(h, '2026-03-11', 1);
    expect(freezeDay(h, '2026-03-12')).toBe(true);
    setHabitValue(h, '2026-03-13', 1);
    const s = streakOf(db.get('habits', h.id)!, '2026-03-13');
    expect(s.current).toBe(3); // frozen day neither breaks nor adds
    expect(freezeDay(db.get('habits', h.id)!, '2026-03-14')).toBe(true);
    expect(freezeDay(db.get('habits', h.id)!, '2026-03-15')).toBe(false); // 2 per month
  });
  it('a missed day breaks the streak', () => {
    const h = createHabit({ name: 'Read' });
    setHabitValue(h, '2026-03-10', 1);
    setHabitValue(h, '2026-03-12', 1);
    expect(streakOf(h, '2026-03-12').current).toBe(1);
    expect(streakOf(h, '2026-03-12').best).toBe(1);
  });
});

describe('rolling split', () => {
  const mk = () => saveRoutine({
    name: 'R', description: '', folder: 'Strength', isDeload: false, scheduleDays: [1, 3, 5], startDate: '2026-10-19',
    days: ['A', 'B', 'C'].map((n) => ({ dayName: n, exercises: [{ exerciseId: exerciseIdFor('Deadlift'), sets: 3, reps: 5, weight: 0, rest: 120 }] })),
  });
  it('rotates through days on training weekdays', () => {
    const r = mk();
    const name = (d: string) => plannedFor(r.id, d).day?.day.dayName;
    expect([name('2026-10-19'), name('2026-10-21'), name('2026-10-23'), name('2026-10-26')]).toEqual(['A', 'B', 'C', 'A']);
    expect(plannedFor(r.id, '2026-10-20').status).toBe('rest');
  });
  it('skipping a day rolls the workout to the next training day', () => {
    const r = mk();
    toggleSkip(r.id, '2026-10-21');
    expect(plannedFor(r.id, '2026-10-21').status).toBe('skipped');
    const name = (d: string) => plannedFor(r.id, d).day?.day.dayName;
    expect([name('2026-10-23'), name('2026-10-26')]).toEqual(['B', 'C']);
    toggleSkip(r.id, '2026-10-21'); // undo
    expect(name('2026-10-23')).toBe('C');
  });
  it('imports all six programs', () => {
    expect(PROGRAMS).toHaveLength(6);
    for (const p of PROGRAMS) {
      const r = importProgram(p);
      expect(db.all('routine_days').filter((d) => d.routineId === r.id)).toHaveLength(p.days.length);
    }
    // every program exercise resolves to a seeded library entry (no accidental custom ones)
    expect(db.all('exercises').filter((e) => e.isCustom)).toHaveLength(0);
  });
});

const session = (date: string, hours: number, fatigue = 3) => db.insert('workout_sessions', {
  id: `s-${date}-${fatigue}`, routineId: null, routineDayId: null, routineName: 'x', dayName: 'd', date, duration: hours * 3600, notes: null,
  unit: 'kg', isDeload: 0, totalVolume: 1000, fatigueRating: fatigue,
});

describe('ACWR / deload', () => {
  const today = todayStr();
  it('flags a load spike (acute/chronic >= 1.5)', () => {
    [28, 25, 22, 19, 16, 13, 10].forEach((d) => session(addDays(today, -d), 1)); // steady baseline
    [6, 5, 4, 3, 2, 1].forEach((d) => session(addDays(today, -d), 2)); // spike week
    const f = computeFatigue(today);
    expect(f.ratio).not.toBeNull();
    expect(f.ratio!).toBeGreaterThanOrEqual(1.5);
    expect(f.deload).toBe(true);
  });
  it('stays quiet for steady training', () => {
    [27, 24, 20, 17, 13, 10, 6, 3].forEach((d) => session(addDays(today, -d), 1));
    const f = computeFatigue(today);
    expect(f.deload).toBe(false);
  });
  it('flags two consecutive high-fatigue sessions', () => {
    session(addDays(today, -3), 1, 4);
    session(addDays(today, -1), 1, 5);
    expect(computeFatigue(today).deload).toBe(true);
  });
});

describe('achievements & PR data', () => {
  it('unlocks First Workout and tracks bests', () => {
    expect(evaluateAchievements()).toHaveLength(0);
    session(todayStr(), 1);
    db.insert('exercise_sets', { id: 'e1', sessionId: `s-${todayStr()}-3`, exerciseId: exerciseIdFor('Barbell Bench Press'), setNumber: 1, reps: 3, weight: 102.5, rpe: null, rir: null, setType: 'normal', weightType: 'standard', timeSeconds: null, distance: null, note: null, completed: 1 });
    const codes = evaluateAchievements().map((a) => a.code);
    expect(codes).toContain('first_workout');
    expect(codes).toContain('bench_100kg');
    expect(exerciseBests(exerciseIdFor('Barbell Bench Press')).maxWeightKg).toBe(102.5);
  });
});

describe('backup', () => {
  it('round-trips deterministically', () => {
    createTask({ title: 'Keep me' }, ['sub']);
    const a = buildBackup();
    const json = JSON.stringify(a);
    factoryReset();
    expect(db.all('tasks')).toHaveLength(0);
    restoreBackup(json);
    expect(db.all('tasks').map((t) => t.title)).toEqual(['Keep me']);
    expect(db.all('subtasks')).toHaveLength(1);
    const b = buildBackup();
    expect(JSON.stringify(b.tables)).toBe(JSON.stringify(a.tables));
    expect(Object.keys(a.tables)).toHaveLength(17);
  });
  it('rejects invalid files without touching existing data', () => {
    createTask({ title: 'Safe' });
    expect(() => restoreBackup('not json')).toThrow();
    expect(() => restoreBackup(JSON.stringify({ app: 'other' }))).toThrow();
    expect(() => restoreBackup(JSON.stringify({ app: 'taskflow-pro', schemaVersion: 1, tables: { tasks: 'oops' } }))).toThrow();
    expect(db.all('tasks').map((t) => t.title)).toEqual(['Safe']);
  });
});

describe('insights engine', () => {
  it('computes workout-task correlation and circadian window', () => {
    const today = todayStr();
    const tasks = [] as ReturnType<typeof createTask>[];
    const sessions = [] as unknown[];
    for (let i = 1; i <= 20; i++) {
      const date = addDays(today, -i);
      const workout = i % 2 === 0;
      if (workout) sessions.push({ id: `w${i}`, date, duration: 3600, unit: 'kg', totalVolume: 1, fatigueRating: 3 });
      const n = workout ? 4 : 2;
      for (let k = 0; k < n; k++) tasks.push({ id: `t${i}${k}`, completed: 1, updatedAt: new Date(`${date}T09:30:00`).toISOString(), dueDate: date } as never);
    }
    const out = generateInsights({ tasks: tasks as never, sessions: sessions as never, habits: [], habitLogs: [], pomodoros: [], isScheduled: () => true }, today);
    const corr = out.find((i) => i.id === 'workout-task');
    expect(corr?.metric).toBe('+100%');
    expect(out.find((i) => i.id === 'circadian')?.metric).toBe('Morning');
    expect(out.find((i) => i.id === 'power-day')).toBeTruthy();
  });
});
