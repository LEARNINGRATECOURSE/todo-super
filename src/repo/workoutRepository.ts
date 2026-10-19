import { db } from '../db/database';
import type {
  Exercise, ExerciseSet, RoutineDay, RoutineExercise, SetType, WeightType, WorkoutAchievement, WorkoutChallenge, WorkoutRoutine, WorkoutSession,
} from '../db/types';
import { ACHIEVEMENTS } from '../data/achievements';
import { exerciseIdFor } from '../data/exercises';
import type { Program } from '../data/programs';
import { addDays, diffDays, mondayOf, nowIso, todayStr, weekday } from '../lib/dates';
import { convert, type Unit } from '../lib/units';
import { parseJSON, sum, uid } from '../lib/util';
import { streakOf } from './habitRepository';
import { getSetting, setSetting } from './settings';

// ---------------------------------------------------------------- routines

export interface RoutineExerciseFull { re: RoutineExercise; exercise: Exercise }
export interface RoutineDayFull { day: RoutineDay; exercises: RoutineExerciseFull[] }
export interface RoutineFull { routine: WorkoutRoutine; days: RoutineDayFull[] }

export function getRoutineFull(id: string): RoutineFull | undefined {
  const routine = db.get('workout_routines', id);
  if (!routine) return undefined;
  const days = db.all('routine_days').filter((d) => d.routineId === id).sort((a, b) => a.order - b.order);
  return {
    routine,
    days: days.map((day) => ({
      day,
      exercises: db.all('routine_exercises')
        .filter((r) => r.routineDayId === day.id)
        .sort((a, b) => a.order - b.order)
        .flatMap((re) => {
          const exercise = db.get('exercises', re.exerciseId);
          return exercise ? [{ re, exercise }] : [];
        }),
    })),
  };
}

export interface RoutineDraft {
  id?: string; name: string; description: string; folder: string; isDeload: boolean; programGoal?: string | null;
  scheduleDays: number[]; startDate: string | null;
  days: { dayName: string; exercises: { exerciseId: string; sets: number; reps: number; weight: number; rest: number; note?: string | null; supersetGroup?: string | null }[] }[];
}

export function saveRoutine(draft: RoutineDraft): WorkoutRoutine {
  return db.transaction(() => {
    const existing = draft.id ? db.get('workout_routines', draft.id) : undefined;
    const routine: WorkoutRoutine = {
      id: existing?.id ?? uid('r_'), name: draft.name.trim() || 'Untitled routine', description: draft.description || null,
      folder: draft.folder, isTemplate: 0, programGoal: draft.programGoal ?? existing?.programGoal ?? null,
      isDeload: draft.isDeload ? 1 : 0, version: (existing?.version ?? 0) + 1,
      scheduleDays: JSON.stringify(draft.scheduleDays.map(String)), startDate: draft.startDate ?? existing?.startDate ?? todayStr(),
      skippedDates: existing?.skippedDates ?? '[]',
    };
    if (existing) db.all('routine_days').filter((d) => d.routineId === existing.id).forEach((d) => db.remove('routine_days', d.id));
    db.insert('workout_routines', routine);
    draft.days.forEach((d, order) => {
      const day: RoutineDay = { id: uid('d_'), routineId: routine.id, dayName: d.dayName.trim() || `Day ${order + 1}`, order };
      db.insert('routine_days', day);
      d.exercises.forEach((e, i) =>
        db.insert('routine_exercises', {
          id: uid('re_'), routineDayId: day.id, exerciseId: e.exerciseId, sets: e.sets, reps: e.reps, weight: e.weight, rest: e.rest,
          note: e.note ?? null, order: i, supersetGroup: e.supersetGroup || null,
        }),
      );
    });
    if (!getSetting('activeRoutineId')) setSetting('activeRoutineId', routine.id);
    return routine;
  });
}

export function routineToDraft(full: RoutineFull): RoutineDraft {
  const r = full.routine;
  return {
    id: r.id, name: r.name, description: r.description ?? '', folder: r.folder, isDeload: !!r.isDeload, programGoal: r.programGoal,
    scheduleDays: parseJSON<string[]>(r.scheduleDays, []).map(Number), startDate: r.startDate,
    days: full.days.map((d) => ({
      dayName: d.day.dayName,
      exercises: d.exercises.map(({ re }) => ({ exerciseId: re.exerciseId, sets: re.sets, reps: re.reps, weight: re.weight, rest: re.rest, note: re.note, supersetGroup: re.supersetGroup })),
    })),
  };
}

export function importProgram(p: Program): WorkoutRoutine {
  const find = (name: string) => {
    const id = exerciseIdFor(name);
    if (db.get('exercises', id)) return id;
    const byName = db.all('exercises').find((e) => e.name.toLowerCase() === name.toLowerCase());
    if (byName) return byName.id;
    return createExercise({ name, muscle: 'Core', category: 'Bodyweight' }).id;
  };
  return saveRoutine({
    name: p.name, description: p.description, folder: p.folder, isDeload: p.folder === 'Deload', programGoal: p.goal,
    scheduleDays: p.scheduleDays, startDate: todayStr(),
    days: p.days.map((d) => ({
      dayName: d.name,
      exercises: d.exercises.map((e) => ({ exerciseId: find(e.name), sets: e.sets, reps: e.reps, weight: e.weight ?? 0, rest: e.rest, supersetGroup: e.superset ?? null })),
    })),
  });
}

export function duplicateRoutine(id: string) {
  const full = getRoutineFull(id);
  if (!full) return;
  const draft = routineToDraft(full);
  return saveRoutine({ ...draft, id: undefined, name: `${draft.name} (copy)`, startDate: todayStr() });
}

export function deleteRoutine(id: string) {
  db.transaction(() => {
    db.remove('workout_routines', id);
    if (getSetting('activeRoutineId') === id) setSetting('activeRoutineId', db.all('workout_routines')[0]?.id ?? '');
  });
}

export function createExercise(e: { name: string; muscle: Exercise['muscle']; category: Exercise['category'] }): Exercise {
  const ex: Exercise = {
    id: uid('ex_'), name: e.name.trim(), muscle: e.muscle, category: e.category, equipment: e.category === 'Bodyweight' ? 'None' : e.category,
    isCustom: 1, instructions: null, isFavorite: 0, primaryMuscle: e.muscle, secondaryMuscles: null, tags: '[]',
  };
  db.insert('exercises', ex);
  return ex;
}
export const toggleFavorite = (id: string) => {
  const e = db.get('exercises', id);
  if (e) db.update('exercises', id, { isFavorite: e.isFavorite ? 0 : 1 });
};

// ----------------------------------------------------- rolling split engine

export type PlannedStatus = 'planned' | 'skipped' | 'rest' | 'none';
export interface Planned { status: PlannedStatus; dayIndex: number; day?: RoutineDayFull; routine?: RoutineFull; sequence?: number }

export const activeRoutine = (): WorkoutRoutine | undefined => {
  const id = getSetting('activeRoutineId');
  return (id ? db.get('workout_routines', id) : undefined) ?? db.all('workout_routines')[0];
};

/**
 * Rolling rotation: training days are the weekdays in `scheduleDays` that are not skipped.
 * The routine day for a date is the count of earlier unskipped training days (since startDate) modulo the day count,
 * so skipping a date hands that workout to the next training day without disturbing the order.
 */
export function plannedFor(routineId: string | undefined, date: string): Planned {
  const full = routineId ? getRoutineFull(routineId) : undefined;
  if (!full || !full.days.length) return { status: 'none', dayIndex: -1 };
  const r = full.routine;
  const sched = parseJSON<string[]>(r.scheduleDays, []).map(Number);
  const skipped = new Set(parseJSON<string[]>(r.skippedDates, []));
  const start = r.startDate ?? date;
  if (date < start) return { status: 'rest', dayIndex: -1, routine: full };
  if (!sched.includes(weekday(date))) return { status: 'rest', dayIndex: -1, routine: full };
  if (skipped.has(date)) return { status: 'skipped', dayIndex: -1, routine: full };
  let count = 0;
  for (let d = start; d < date; d = addDays(d, 1)) if (sched.includes(weekday(d)) && !skipped.has(d)) count++;
  const dayIndex = count % full.days.length;
  return { status: 'planned', dayIndex, day: full.days[dayIndex], routine: full, sequence: count + 1 };
}

export function toggleSkip(routineId: string, date: string) {
  const r = db.get('workout_routines', routineId);
  if (!r) return false;
  const skipped = parseJSON<string[]>(r.skippedDates, []);
  const isSkipped = skipped.includes(date);
  db.update('workout_routines', routineId, { skippedDates: JSON.stringify(isSkipped ? skipped.filter((d) => d !== date) : [...skipped, date].sort()) });
  return !isSkipped;
}

// ----------------------------------------------------------------- sessions

export interface DraftSet {
  id: string; setType: SetType; weightType: WeightType; weight: number; reps: number; rpe: number | null; rir: number | null;
  timeSeconds: number | null; distance: number | null; note: string; completed: boolean;
}
export interface DraftExercise { exerciseId: string; rest: number; supersetGroup: string | null; note: string; sets: DraftSet[] }
export interface ActiveWorkout {
  startedAt: number; routineId: string | null; routineDayId: string | null; routineName: string | null; dayName: string | null;
  date: string; unit: Unit; exercises: DraftExercise[]; isDeload: boolean; fatigueRating: number; notes: string;
  restEndsAt: number | null; restTotal: number;
}

export const setVolume = (s: Pick<ExerciseSet, 'weight' | 'reps' | 'weightType' | 'setType'>) =>
  s.setType === 'warmup' || s.weightType === 'cardio' ? 0 : s.weight * s.reps;

export interface SessionSummary { session: WorkoutSession; sets: ExerciseSet[]; prs: { exerciseId: string; name: string; kind: 'weight' | 'volume' }[] }

export function saveSession(a: ActiveWorkout, prs: SessionSummary['prs'] = []): SessionSummary {
  const sessionId = uid('w_');
  const sets: ExerciseSet[] = [];
  a.exercises.forEach((ex) => {
    let n = 0;
    ex.sets.filter((s) => s.completed).forEach((s) => {
      n++;
      sets.push({
        id: uid('es_'), sessionId, exerciseId: ex.exerciseId, setNumber: n, reps: s.reps, weight: s.weight, rpe: s.rpe, rir: s.rir,
        setType: s.setType, weightType: s.weightType, timeSeconds: s.timeSeconds, distance: s.distance, note: s.note || null, completed: 1,
      });
    });
  });
  const session: WorkoutSession = {
    id: sessionId, routineId: a.routineId, routineDayId: a.routineDayId, routineName: a.routineName, dayName: a.dayName, date: a.date,
    duration: Math.round((Date.now() - a.startedAt) / 1000), notes: a.notes || null, unit: a.unit, isDeload: a.isDeload ? 1 : 0,
    totalVolume: sum(sets.map(setVolume)), fatigueRating: a.fatigueRating, startedAt: new Date(a.startedAt).toISOString(),
  };
  db.transaction(() => {
    db.insert('workout_sessions', session);
    sets.forEach((s) => db.insert('exercise_sets', s));
    if (prs.length) setSetting('prCount', String(Number(getSetting('prCount', '0')) + prs.length));
  });
  return { session, sets, prs };
}

export const deleteSession = (id: string) => db.remove('workout_sessions', id);

export const setsOfSession = (sessionId: string) => db.all('exercise_sets').filter((s) => s.sessionId === sessionId);
export const sessionOn = (date: string) => db.all('workout_sessions').filter((s) => s.date === date);

/** Sets from the most recent session containing the exercise (for auto-prefill). */
export function lastPerformance(exerciseId: string): { session: WorkoutSession; sets: ExerciseSet[] } | undefined {
  const sessions = db.all('workout_sessions').slice().sort((a, b) => (a.date === b.date ? (a.startedAt ?? '').localeCompare(b.startedAt ?? '') : a.date.localeCompare(b.date)));
  for (let i = sessions.length - 1; i >= 0; i--) {
    const sets = db.all('exercise_sets').filter((s) => s.sessionId === sessions[i].id && s.exerciseId === exerciseId);
    if (sets.length) return { session: sessions[i], sets: sets.sort((a, b) => a.setNumber - b.setNumber) };
  }
  return undefined;
}

export interface Bests { maxWeightKg: number; maxVolumeKg: number; hasHistory: boolean }
/** All-time bests (kg) from completed working sets. */
export function exerciseBests(exerciseId: string): Bests {
  const sessions = new Map(db.all('workout_sessions').map((s) => [s.id, s]));
  let maxWeightKg = 0, maxVolumeKg = 0, hasHistory = false;
  for (const s of db.all('exercise_sets')) {
    if (s.exerciseId !== exerciseId || !s.completed || s.setType === 'warmup' || s.weightType === 'cardio') continue;
    const unit = sessions.get(s.sessionId)?.unit ?? 'kg';
    const w = convert(s.weight, unit, 'kg');
    hasHistory = true;
    maxWeightKg = Math.max(maxWeightKg, w);
    maxVolumeKg = Math.max(maxVolumeKg, w * s.reps);
  }
  return { maxWeightKg, maxVolumeKg, hasHistory };
}

// --------------------------------------------------------------- fatigue / ACWR

export interface Fatigue {
  acuteHours: number; chronicHours: number; ratio: number | null; deload: boolean; reasons: string[]; building: boolean;
}
/** ACWR = acute training hours (7d) / weekly-average chronic hours (28d). */
export function computeFatigue(today = todayStr()): Fatigue {
  const sessions = db.all('workout_sessions');
  const hours = (from: string) => sum(sessions.filter((s) => s.date > from && s.date <= today).map((s) => s.duration / 3600));
  const acuteHours = hours(addDays(today, -7));
  const chronicHours = hours(addDays(today, -28)) / 4;
  const first = sessions.map((s) => s.date).sort()[0];
  const building = !first || diffDays(today, first) < 21;
  const ratio = !building && chronicHours > 0 ? acuteHours / chronicHours : null;
  const reasons: string[] = [];
  if (ratio !== null && ratio >= 1.5) reasons.push(`ACWR ${ratio.toFixed(2)} ≥ 1.5 — training load spiked versus your 4-week baseline.`);
  const recent = sessions.slice().sort((a, b) => (a.date + (a.startedAt ?? '')).localeCompare(b.date + (b.startedAt ?? ''))).slice(-2);
  if (recent.length === 2 && recent.every((s) => s.fatigueRating >= 4)) reasons.push('Your last two sessions were rated fatigue 4+/5.');
  return { acuteHours, chronicHours, ratio, deload: reasons.length > 0, reasons, building };
}

// ---------------------------------------------------- achievements / challenges

const mainLiftMaxKg = (exId: string) => exerciseBests(exId).maxWeightKg;
const hasHabitStreak = (n: number) => db.all('habits').some((h) => streakOf(h).best >= n);

const CHECKS: Record<string, () => boolean> = {
  first_workout: () => db.all('workout_sessions').length >= 1,
  ten_workouts: () => db.all('workout_sessions').length >= 10,
  century_club: () => db.all('workout_sessions').length >= 100,
  bench_100kg: () => mainLiftMaxKg('ex-barbell-bench-press') >= 100,
  squat_140kg: () => mainLiftMaxKg('ex-barbell-back-squat') >= 140,
  deadlift_180kg: () => mainLiftMaxKg('ex-deadlift') >= 180,
  ton_session: () => db.all('workout_sessions').some((s) => convert(s.totalVolume, s.unit, 'kg') >= 10000),
  iron_week: () => {
    const weeks: Record<string, number> = {};
    db.all('workout_sessions').forEach((s) => { const w = mondayOf(s.date); weeks[w] = (weeks[w] ?? 0) + 1; });
    return Object.values(weeks).some((n) => n >= 4);
  },
  streak_master: () => hasHabitStreak(7),
  pr_hunter: () => Number(getSetting('prCount', '0')) >= 5,
  deep_focus: () => db.all('pomodoro_sessions').filter((p) => p.type === 'work').length >= 10,
};

/** Unlocks any newly satisfied achievements and returns them. */
export function evaluateAchievements(): WorkoutAchievement[] {
  const unlocked: WorkoutAchievement[] = [];
  db.transaction(() => {
    for (const def of ACHIEVEMENTS) {
      const row = db.get('workout_achievements', `ach-${def.code}`);
      if (!row || row.unlockedAt) continue;
      if (CHECKS[def.code]?.()) {
        const next = db.update('workout_achievements', row.id, { unlockedAt: nowIso() });
        if (next) unlocked.push(next);
      }
    }
  });
  return unlocked;
}

/** Challenges count the 30 days before their deadline. */
export function refreshChallenges() {
  db.transaction(() => {
    for (const c of db.all('workout_challenges')) {
      const from = addDays(c.deadline, -30);
      const inWindow = db.all('workout_sessions').filter((s) => s.date > from && s.date <= c.deadline);
      const value = c.unit === 'sessions' ? inWindow.length : sum(inWindow.map((s) => convert(s.totalVolume, s.unit, 'kg')));
      db.update('workout_challenges', c.id, { currentValue: Math.round(value), completed: value >= c.targetValue ? 1 : 0 });
    }
  });
}

export function createChallenge(c: { title: string; kind: 'volume' | 'sessions'; target: number; deadline: string }): WorkoutChallenge {
  const ch: WorkoutChallenge = {
    id: uid('c_'), title: c.title.trim(), description: c.kind === 'volume' ? `Lift ${c.target.toLocaleString()} kg total volume` : `Complete ${c.target} workouts`,
    targetValue: c.target, currentValue: 0, unit: c.kind === 'volume' ? 'kg' : 'sessions', deadline: c.deadline, completed: 0, icon: c.kind === 'volume' ? 'Weight' : 'CalendarCheck',
  };
  db.insert('workout_challenges', ch);
  refreshChallenges();
  return ch;
}

// ------------------------------------------------------------ body metrics

export function saveMeasurement(m: Omit<import('../db/types').BodyMeasurement, 'id'> & { id?: string }) {
  db.insert('body_measurements', { ...m, id: m.id ?? uid('bm_') });
}
export const deleteMeasurement = (id: string) => db.remove('body_measurements', id);
