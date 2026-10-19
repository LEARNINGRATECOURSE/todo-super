import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/database';
import type { DraftSet } from '../repo/workoutRepository';
import { createExercise, saveSession } from '../repo/workoutRepository';
import { seedDefaults } from '../repo/seed';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { brzycki, epley, estimate1RM, repsAtPercent } from './oneRepMax';
import { calculatePlates } from './plates';
import { convert, displayWeight, roundWeight } from './units';

describe('plates', () => {
  it('loads a 100 kg target on a 20 kg bar greedily per side', () => {
    const r = calculatePlates(100, 20, 'kg');
    expect(r.perSide.map((p) => [p.plate.weight, p.count])).toEqual([[25, 1], [15, 1]]);
    expect(r.achieved).toBe(100);
    expect(r.remainder).toBe(0);
  });
  it('loads 225 lb on a 45 lb bar', () => {
    const r = calculatePlates(225, 45, 'lb');
    expect(r.perSide.map((p) => [p.plate.weight, p.count])).toEqual([[45, 2]]);
    expect(r.remainder).toBe(0);
  });
  it('reports the unloadable remainder in total weight', () => {
    const r = calculatePlates(101, 20, 'kg');
    expect(r.achieved).toBe(100);
    expect(r.remainder).toBe(1);
  });
  it('flags targets below the bar', () => {
    expect(calculatePlates(10, 20, 'kg').belowBar).toBe(true);
    expect(calculatePlates(20, 20, 'kg').belowBar).toBe(false);
  });
});

describe('1RM', () => {
  it('returns 0 for a cleared reps field across every formula', () => {
    expect(epley(100, 0)).toBe(0);
    expect(brzycki(100, 0)).toBe(0);
    expect(estimate1RM(100, 0)).toBe(0);
  });
  it('inverse-Epley reps at percentage', () => {
    expect(repsAtPercent(100)).toBe(1);
    expect(repsAtPercent(50)).toBe(30);
  });
});

describe('units', () => {
  it('round-trips kg through lb within rounding', () => {
    expect(convert(convert(100, 'kg', 'lb'), 'lb', 'kg')).toBeCloseTo(100, 6);
    expect(convert(50, 'lb', 'lb')).toBe(50);
  });
  it('rounds to plate-friendly steps per unit', () => {
    expect(roundWeight(62.3, 'kg')).toBe(62.25);
    expect(roundWeight(137.7, 'lb')).toBe(137.5);
  });
  it('displays a stored weight in the global unit', () => {
    expect(displayWeight(62.5, 'kg', 'kg')).toBe('62.5');
    expect(displayWeight(100, 'kg', 'lb')).toBe('220.5');
  });
});

describe('workout PR detection', () => {
  const set = (p: Partial<DraftSet>): DraftSet => ({
    id: `s_${Math.random()}`, setType: 'normal', weightType: 'standard', weight: 0, reps: 5, rpe: null, rir: null,
    timeSeconds: null, distance: null, note: '', completed: false, ...p,
  });
  let exerciseId = '';

  beforeEach(() => {
    db.clear();
    seedDefaults();
    exerciseId = createExercise({ name: 'Test Press', muscle: 'Chest', category: 'Barbell' }).id;
    // One prior session at 100 kg x 5 gives the exercise a history.
    saveSession({
      startedAt: Date.now() - 3600_000, routineId: null, routineDayId: null, routineName: 'Old', dayName: null, date: '2026-10-01', unit: 'kg',
      exercises: [{ exerciseId, rest: 90, supersetGroup: null, note: '', sets: [set({ weight: 100, reps: 5, completed: true })] }],
      isDeload: false, fatigueRating: 3, notes: '', restEndsAt: null, restTotal: 0,
    });
    useWorkoutStore.setState({ active: null, pr: null });
    useWorkoutStore.getState().startWorkout();
    useWorkoutStore.getState().addExercise(exerciseId);
  });

  it('records a weight PR for a completed heavier set', () => {
    const st = useWorkoutStore.getState();
    st.updateSet(0, 0, { weight: 105 });
    st.completeSet(0, 0);
    st.addSet(0);
    st.updateSet(0, 1, { weight: 60, reps: 5 });
    st.completeSet(0, 1);
    const sum = useWorkoutStore.getState().finish();
    expect(sum?.prs.map((p) => p.kind)).toContain('weight');
  });

  it('drops a PR when its set is un-completed before finishing', () => {
    const st = useWorkoutStore.getState();
    st.updateSet(0, 0, { weight: 105 });
    st.completeSet(0, 0);
    st.completeSet(0, 0); // undo
    st.addSet(0);
    st.updateSet(0, 1, { weight: 60, reps: 5 });
    st.completeSet(0, 1);
    const sum = useWorkoutStore.getState().finish();
    expect(sum?.prs).toEqual([]);
  });

  it('does not record PRs when there is no history', () => {
    const other = createExercise({ name: 'Brand New Lift', muscle: 'Legs', category: 'Barbell' }).id;
    const st = useWorkoutStore.getState();
    st.addExercise(other);
    st.updateSet(1, 0, { weight: 200 });
    st.completeSet(1, 0);
    const sum = useWorkoutStore.getState().finish();
    expect(sum?.prs).toEqual([]);
  });
});
