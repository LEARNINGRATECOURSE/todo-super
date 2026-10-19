import { create } from 'zustand';
import { db } from '../db/database';
import type { BodyMeasurement, Exercise, ExerciseSet, RoutineDay, RoutineExercise, SetType, WeightType, WorkoutAchievement, WorkoutChallenge, WorkoutRoutine, WorkoutSession } from '../db/types';
import { chime } from '../lib/audio';
import { todayStr } from '../lib/dates';
import { convert, incrementFor, roundWeight, type Unit } from '../lib/units';
import { haptic, uid } from '../lib/util';
import {
  evaluateAchievements, exerciseBests, getRoutineFull, lastPerformance, refreshChallenges, saveSession, type ActiveWorkout, type DraftExercise, type DraftSet, type RoutineDayFull,
  type SessionSummary,
} from '../repo/workoutRepository';
import { getSetting } from '../repo/settings';
import { useUIStore } from './useUIStore';

const ACTIVE_KEY = 'taskflow.activeWorkout';
export const SET_TYPES: SetType[] = ['normal', 'warmup', 'dropset', 'failure', 'amrap', 'rest_pause', 'superset'];
export const SET_TYPE_LABEL: Record<SetType, string> = { normal: '#', warmup: 'W', dropset: 'D', failure: 'F', amrap: 'A', rest_pause: 'RP', superset: 'S' };
export const WEIGHT_TYPES: WeightType[] = ['standard', 'bodyweight', 'assisted', 'cardio'];

export interface PREvent { exerciseId: string; name: string; kind: 'weight' | 'volume'; value: string }

interface WorkoutState {
  routines: WorkoutRoutine[]; routineDays: RoutineDay[]; routineExercises: RoutineExercise[]; exercises: Exercise[];
  sessions: WorkoutSession[]; sets: ExerciseSet[]; measurements: BodyMeasurement[];
  achievements: WorkoutAchievement[]; challenges: WorkoutChallenge[];
  active: ActiveWorkout | null;
  pr: PREvent | null;
  prs: SessionSummary['prs'];
  sync: () => void;
  startWorkout: (opts?: { routineId?: string; day?: RoutineDayFull; deload?: boolean }) => void;
  patchActive: (p: Partial<ActiveWorkout>) => void;
  addExercise: (exerciseId: string) => void;
  removeExercise: (idx: number) => void;
  addSet: (exIdx: number) => void;
  removeSet: (exIdx: number, setIdx: number) => void;
  updateSet: (exIdx: number, setIdx: number, p: Partial<DraftSet>) => void;
  bumpWeight: (exIdx: number, setIdx: number, dir?: 1 | -1) => void;
  cycleSetType: (exIdx: number, setIdx: number) => void;
  cycleWeightType: (exIdx: number, setIdx: number) => void;
  completeSet: (exIdx: number, setIdx: number) => void;
  adjustRest: (deltaSec: number) => void;
  skipRest: () => void;
  finish: () => SessionSummary | null;
  discard: () => void;
  dismissPR: () => void;
}

const snapshot = () => ({
  routines: [...db.all('workout_routines')], routineDays: [...db.all('routine_days')], routineExercises: [...db.all('routine_exercises')],
  exercises: [...db.all('exercises')], sessions: [...db.all('workout_sessions')], sets: [...db.all('exercise_sets')],
  measurements: [...db.all('body_measurements')], achievements: [...db.all('workout_achievements')], challenges: [...db.all('workout_challenges')],
});

const loadActive = (): ActiveWorkout | null => {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    return raw ? (JSON.parse(raw) as ActiveWorkout) : null;
  } catch { return null; }
};
const persistActive = (a: ActiveWorkout | null) => {
  try { if (a) localStorage.setItem(ACTIVE_KEY, JSON.stringify(a)); else localStorage.removeItem(ACTIVE_KEY); } catch { /* ignore */ }
};

const unitOf = (): Unit => (getSetting('unit', 'kg') === 'lb' ? 'lb' : 'kg');
const blankSet = (p: Partial<DraftSet> = {}): DraftSet => ({
  id: uid('ds_'), setType: 'normal', weightType: 'standard', weight: 0, reps: 8, rpe: null, rir: null, timeSeconds: null, distance: null, note: '', completed: false, ...p,
});

/** Builds draft sets for an exercise, prefilled from the previous session (converted to the session unit) or the routine template. */
function draftExercise(exerciseId: string, unit: Unit, tpl?: Pick<RoutineExercise, 'sets' | 'reps' | 'weight' | 'rest' | 'supersetGroup'>): DraftExercise {
  const last = lastPerformance(exerciseId);
  const exercise = db.get('exercises', exerciseId);
  const isCardio = exercise?.muscle === 'Cardio' && exercise.category === 'Cardio';
  const wType: WeightType = isCardio ? 'cardio' : exercise?.category === 'Bodyweight' ? 'bodyweight' : 'standard';
  const count = tpl?.sets ?? (last ? last.sets.length : 3);
  const sets: DraftSet[] = Array.from({ length: count }, (_, i) => {
    const prev = last?.sets[Math.min(i, last.sets.length - 1)];
    const w = prev ? roundWeight(convert(prev.weight, last!.session.unit, unit), unit) : tpl?.weight ? roundWeight(convert(tpl.weight, 'kg', unit), unit) : 0;
    return blankSet({
      weight: wType === 'bodyweight' || wType === 'cardio' ? 0 : w, reps: prev?.reps ?? tpl?.reps ?? 8, weightType: prev?.weightType ?? wType,
      setType: prev && prev.setType !== 'warmup' ? prev.setType : 'normal', timeSeconds: wType === 'cardio' ? 600 : null, distance: wType === 'cardio' ? 0 : null,
    });
  });
  return { exerciseId, rest: tpl?.rest ?? 90, supersetGroup: tpl?.supersetGroup ?? null, note: '', sets };
}

export const useWorkoutStore = create<WorkoutState>((set, get) => {
  const mutate = (fn: (a: ActiveWorkout) => ActiveWorkout | void) => {
    const cur = get().active;
    if (!cur) return;
    const draft = structuredClone(cur);
    const next = fn(draft) ?? draft;
    persistActive(next);
    set({ active: next });
  };
  return {
    ...snapshot(),
    active: loadActive(),
    pr: null,
    prs: [],
    sync: () => set(snapshot()),

    startWorkout: (opts) => {
      if (get().active) return;
      const unit = unitOf();
      const full = opts?.day;
      const routine = opts?.routineId ? db.get('workout_routines', opts.routineId) : undefined;
      const a: ActiveWorkout = {
        startedAt: Date.now(), routineId: routine?.id ?? null, routineDayId: full?.day.id ?? null, routineName: routine?.name ?? 'Quick Workout',
        dayName: full?.day.dayName ?? null, date: todayStr(), unit,
        exercises: full ? full.exercises.map(({ re }) => draftExercise(re.exerciseId, unit, re)) : [],
        isDeload: !!(opts?.deload ?? routine?.isDeload), fatigueRating: 3, notes: '', restEndsAt: null, restTotal: 0,
      };
      persistActive(a);
      set({ active: a, prs: [] });
    },
    patchActive: (p) => mutate((a) => ({ ...a, ...p })),
    addExercise: (exerciseId) => mutate((a) => { a.exercises.push(draftExercise(exerciseId, a.unit)); }),
    removeExercise: (idx) => mutate((a) => { a.exercises.splice(idx, 1); }),
    addSet: (exIdx) => mutate((a) => {
      const ex = a.exercises[exIdx];
      const prev = ex.sets[ex.sets.length - 1];
      ex.sets.push(blankSet(prev ? { weight: prev.weight, reps: prev.reps, weightType: prev.weightType, setType: prev.setType === 'warmup' ? 'normal' : prev.setType, timeSeconds: prev.timeSeconds, distance: prev.distance } : {}));
    }),
    removeSet: (exIdx, setIdx) => mutate((a) => { a.exercises[exIdx].sets.splice(setIdx, 1); }),
    updateSet: (exIdx, setIdx, p) => mutate((a) => { Object.assign(a.exercises[exIdx].sets[setIdx], p); }),
    bumpWeight: (exIdx, setIdx, dir = 1) => mutate((a) => {
      const s = a.exercises[exIdx].sets[setIdx];
      s.weight = Math.max(0, roundWeight(s.weight + dir * incrementFor(a.unit), a.unit));
    }),
    cycleSetType: (exIdx, setIdx) => mutate((a) => {
      const s = a.exercises[exIdx].sets[setIdx];
      s.setType = SET_TYPES[(SET_TYPES.indexOf(s.setType) + 1) % SET_TYPES.length];
    }),
    cycleWeightType: (exIdx, setIdx) => mutate((a) => {
      const s = a.exercises[exIdx].sets[setIdx];
      s.weightType = WEIGHT_TYPES[(WEIGHT_TYPES.indexOf(s.weightType) + 1) % WEIGHT_TYPES.length];
      if (s.weightType === 'cardio') { s.timeSeconds ??= 600; s.distance ??= 0; }
    }),
    completeSet: (exIdx, setIdx) => {
      const a = get().active;
      if (!a) return;
      const ex = a.exercises[exIdx];
      const s = ex.sets[setIdx];
      const nowDone = !s.completed;
      let pr: PREvent | null = null;
      if (nowDone && s.setType !== 'warmup' && s.weightType !== 'cardio' && s.weight > 0) {
        const best = exerciseBests(ex.exerciseId);
        const kg = convert(s.weight, a.unit, 'kg');
        // Include bests already set earlier in this same workout.
        let sessWeight = 0, sessVol = 0;
        a.exercises.filter((e) => e.exerciseId === ex.exerciseId).forEach((e) =>
          e.sets.forEach((x) => { if (x.completed && x.id !== s.id && x.setType !== 'warmup' && x.weightType !== 'cardio') { const w = convert(x.weight, a.unit, 'kg'); sessWeight = Math.max(sessWeight, w); sessVol = Math.max(sessVol, w * x.reps); } }));
        const name = db.get('exercises', ex.exerciseId)?.name ?? 'Exercise';
        const topW = Math.max(best.maxWeightKg, sessWeight);
        const topV = Math.max(best.maxVolumeKg, sessVol);
        if (best.hasHistory && kg > topW + 0.001) pr = { exerciseId: ex.exerciseId, name, kind: 'weight', value: `${s.weight}${a.unit} × ${s.reps}` };
        else if (best.hasHistory && kg * s.reps > topV + 0.001) pr = { exerciseId: ex.exerciseId, name, kind: 'volume', value: `${s.weight}${a.unit} × ${s.reps}` };
      }
      mutate((w) => {
        const t = w.exercises[exIdx].sets[setIdx];
        t.completed = nowDone;
        if (nowDone) { w.restEndsAt = Date.now() + ex.rest * 1000; w.restTotal = ex.rest; } else { w.restEndsAt = null; }
      });
      haptic(15);
      if (pr) {
        const event = pr;
        set((st) => ({ pr: event, prs: st.prs.some((p) => p.exerciseId === event.exerciseId && p.kind === event.kind) ? st.prs : [...st.prs, { exerciseId: event.exerciseId, name: event.name, kind: event.kind }] }));
        chime('pr');
        haptic([30, 60, 30, 60, 80]);
      }
    },
    adjustRest: (delta) => mutate((a) => {
      const base = a.restEndsAt && a.restEndsAt > Date.now() ? a.restEndsAt : Date.now();
      a.restEndsAt = Math.max(Date.now() + 1000, base + delta * 1000);
      a.restTotal = Math.max(a.restTotal, Math.round((a.restEndsAt - Date.now()) / 1000));
    }),
    skipRest: () => mutate((a) => { a.restEndsAt = null; }),
    finish: () => {
      const a = get().active;
      if (!a) return null;
      const done = a.exercises.some((e) => e.sets.some((s) => s.completed));
      if (!done) return null;
      const summary = saveSession(a, get().prs);
      persistActive(null);
      set({ active: null, pr: null, prs: [] });
      refreshChallenges();
      for (const ach of evaluateAchievements()) useUIStore.getState().toast(`🏆 Achievement unlocked: ${ach.title}`, { tone: 'success' });
      chime('complete');
      return summary;
    },
    discard: () => { persistActive(null); set({ active: null, pr: null, prs: [] }); },
    dismissPR: () => set({ pr: null }),
  };
});

db.onChange(() => useWorkoutStore.getState().sync());
export { getRoutineFull };
