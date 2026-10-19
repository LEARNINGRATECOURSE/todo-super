import type { Unit } from './units';

export interface PlateSpec { weight: number; color: string; label: string; height: number }

export const PLATES: Record<Unit, PlateSpec[]> = {
  kg: [
    { weight: 25, color: '#e03e3e', label: '25', height: 100 },
    { weight: 20, color: '#2f6fed', label: '20', height: 100 },
    { weight: 15, color: '#f2c200', label: '15', height: 86 },
    { weight: 10, color: '#27a860', label: '10', height: 72 },
    { weight: 5, color: '#f5f6f8', label: '5', height: 58 },
    { weight: 2.5, color: '#8a9099', label: '2.5', height: 48 },
    { weight: 1.25, color: '#ff8a3d', label: '1.25', height: 40 },
  ],
  lb: [
    { weight: 45, color: '#2f6fed', label: '45', height: 100 },
    { weight: 35, color: '#f2c200', label: '35', height: 88 },
    { weight: 25, color: '#27a860', label: '25', height: 76 },
    { weight: 10, color: '#f5f6f8', label: '10', height: 60 },
    { weight: 5, color: '#8a9099', label: '5', height: 50 },
    { weight: 2.5, color: '#8a9099', label: '2.5', height: 42 },
  ],
};
export const DEFAULT_BAR: Record<Unit, number> = { kg: 20, lb: 45 };

export interface PlateResult {
  perSide: { plate: PlateSpec; count: number }[];
  achieved: number;
  remainder: number;
  belowBar: boolean;
}

/** Greedy per-side plate loading; `remainder` is what cannot be loaded with the available plates. */
export function calculatePlates(target: number, bar: number, unit: Unit): PlateResult {
  if (target < bar) return { perSide: [], achieved: bar, remainder: 0, belowBar: true };
  let perSideLeft = Math.round(((target - bar) / 2) * 1000) / 1000;
  const perSide: PlateResult['perSide'] = [];
  for (const plate of PLATES[unit]) {
    const count = Math.floor(perSideLeft / plate.weight + 1e-9);
    if (count > 0) {
      perSide.push({ plate, count });
      perSideLeft = Math.round((perSideLeft - count * plate.weight) * 1000) / 1000;
    }
  }
  const remainder = Math.round(perSideLeft * 2 * 1000) / 1000;
  return { perSide, achieved: Math.round((target - remainder) * 1000) / 1000, remainder, belowBar: false };
}
