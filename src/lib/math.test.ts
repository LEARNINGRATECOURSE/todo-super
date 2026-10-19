import { describe, expect, it } from 'vitest';
import { brzycki, epley, estimate1RM, percentChart } from './oneRepMax';
import { calculatePlates } from './plates';
import { convert, KG_TO_LB } from './units';
import { nextOccurrence } from './recurrence';
import { addDays, relativeLabel } from './dates';

describe('1RM', () => {
  it('matches Epley and Brzycki formulas', () => {
    expect(epley(100, 5)).toBeCloseTo(116.667, 2);
    expect(brzycki(100, 5)).toBeCloseTo(112.5, 2);
    expect(estimate1RM(100, 5)).toBeCloseTo(114.583, 2);
    expect(estimate1RM(100, 1)).toBe(100);
  });
  it('builds the 10-row percentage chart', () => {
    const chart = percentChart(200);
    expect(chart.map((c) => c.pct)).toEqual([100, 95, 90, 85, 80, 75, 70, 65, 60, 50]);
    expect(chart[2].weight).toBe(180);
  });
});

describe('plates', () => {
  it('loads 100 kg on a 20 kg bar as 25 + 15 per side', () => {
    const r = calculatePlates(100, 20, 'kg');
    expect(r.perSide.map((p) => [p.plate.weight, p.count])).toEqual([[25, 1], [15, 1]]);
    expect(r.remainder).toBe(0);
  });
  it('uses small plates and reports remainders', () => {
    expect(calculatePlates(102.5, 20, 'kg').remainder).toBe(0);
    expect(calculatePlates(101, 20, 'kg').remainder).toBe(1);
  });
  it('handles lb and below-bar targets', () => {
    const r = calculatePlates(225, 45, 'lb');
    expect(r.perSide).toEqual([expect.objectContaining({ count: 2 })]);
    expect(r.perSide[0].plate.weight).toBe(45);
    expect(calculatePlates(10, 20, 'kg').belowBar).toBe(true);
  });
});

describe('units', () => {
  it('converts with 2.20462', () => {
    expect(convert(100, 'kg', 'lb')).toBeCloseTo(100 * KG_TO_LB, 5);
    expect(convert(220.462, 'lb', 'kg')).toBeCloseTo(100, 3);
  });
});

describe('recurrence', () => {
  const base = { recurrenceEndDate: null, recurrenceDays: null };
  it('daily / weekly', () => {
    expect(nextOccurrence({ ...base, recurringRule: 'daily', dueDate: '2026-10-19' })).toBe('2026-10-20');
    expect(nextOccurrence({ ...base, recurringRule: 'weekly', dueDate: '2026-10-19' })).toBe('2026-10-26');
  });
  it('weekdays skip the weekend', () => {
    expect(nextOccurrence({ ...base, recurringRule: 'weekdays', dueDate: '2026-10-23' })).toBe('2026-10-26'); // Fri -> Mon
  });
  it('monthly clamps to month end', () => {
    expect(nextOccurrence({ ...base, recurringRule: 'monthly', dueDate: '2026-01-31' })).toBe('2026-02-28');
  });
  it('custom days and end date', () => {
    expect(nextOccurrence({ ...base, recurringRule: 'custom', recurrenceDays: '["1","3"]', dueDate: '2026-10-19' })).toBe('2026-10-21');
    expect(nextOccurrence({ recurringRule: 'daily', dueDate: '2026-10-19', recurrenceEndDate: '2026-10-19', recurrenceDays: null })).toBeNull();
  });
});

describe('dates', () => {
  it('labels relative days', () => {
    expect(relativeLabel('2026-10-19', '2026-10-19')).toBe('Today');
    expect(relativeLabel('2026-10-18', '2026-10-19')).toBe('Yesterday');
    expect(relativeLabel('2026-10-20', '2026-10-19')).toBe('Tomorrow');
    expect(relativeLabel('2026-10-25', '2026-10-19')).toBe('25 Oct');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});
