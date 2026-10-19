import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/database';
import { addDays, todayStr } from '../lib/dates';
import { HabitHeatmap } from '../components/HabitHeatmap';
import { useAppStore } from '../store/useAppStore';
import {
  checkinsOf, createHabit, freezeDay, logFor, setHabitValue, slotsFor, streakOf, toggleBoolean, toggleSlot, unfreezeDay, updateHabit,
} from './habitRepository';

beforeEach(() => { db.clear(); useAppStore.getState().sync(); });

const D = '2026-03-10';

describe('habit freezes', () => {
  it('unfreezing restores the progress recorded on that day', () => {
    const h = createHabit({ name: 'Water', type: 'counter', target: 8 });
    setHabitValue(h, D, 3);
    expect(freezeDay(h, D)).toBe(true);
    unfreezeDay(db.get('habits', h.id)!, D);
    const log = logFor(h.id, D);
    expect(log?.value).toBe(3);
    expect(log?.status).toBe('partial');
    expect(log?.isFrozen).toBe(0);
  });
  it('a completed day cannot be frozen', () => {
    const h = createHabit({ name: 'Read' });
    toggleBoolean(h, D);
    expect(freezeDay(db.get('habits', h.id)!, D)).toBe(false);
    expect(logFor(h.id, D)?.completed).toBe(1);
  });
});

describe('habit slots', () => {
  it('duplicate fixed times collapse so the habit can still complete', () => {
    const h = createHabit({ name: 'Meds', scheduleType: 'fixed', scheduleConfig: JSON.stringify({ fixedTimes: ['08:00', '08:00'] }) });
    expect(slotsFor(h)).toEqual(['08:00']);
    expect(toggleSlot(h, D, '08:00').completedNow).toBe(true);
  });
});

describe('editing a habit re-derives stored completion', () => {
  it('lowering a counter target completes a day that was partial', () => {
    const h = createHabit({ name: 'Water', type: 'counter', target: 8 });
    setHabitValue(h, D, 5);
    expect(logFor(h.id, D)?.completed).toBe(0);
    updateHabit(h.id, { target: 4 });
    const log = logFor(h.id, D);
    expect(log?.completed).toBe(1);
    expect(log?.status).toBe('full');
    expect(streakOf(db.get('habits', h.id)!, D).current).toBe(1);
  });
  it('removing a check-in time drops it from the day and recounts', () => {
    const h = createHabit({ name: 'Vit', scheduleType: 'fixed', scheduleConfig: JSON.stringify({ fixedTimes: ['08:00', '20:00'] }) });
    toggleSlot(h, D, '08:00');
    toggleSlot(h, D, '20:00');
    updateHabit(h.id, { scheduleConfig: JSON.stringify({ fixedTimes: ['08:00'] }) });
    const log = logFor(h.id, D);
    expect(checkinsOf(log)).toEqual(['08:00']);
    expect(log?.value).toBe(1);
    expect(log?.completed).toBe(1);
  });
});

describe('heatmap', () => {
  it('excludes frozen days from the day denominator', () => {
    const today = todayStr();
    const yesterday = addDays(today, -1);
    const h = createHabit({ name: 'Stretch' });
    expect(freezeDay(h, yesterday)).toBe(true);
    useAppStore.getState().sync();
    const html = renderToStaticMarkup(createElement(HabitHeatmap, { habitId: null, days: 3 }));
    expect(html).toContain(`title="${yesterday}: 0/0 habits"`);
  });
});
