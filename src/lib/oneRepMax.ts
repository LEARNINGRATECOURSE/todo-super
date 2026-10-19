/** Epley: w * (1 + r/30) */
export const epley = (w: number, r: number) => (r <= 0 ? 0 : r <= 1 ? w : w * (1 + r / 30));
/** Brzycki: w * 36 / (37 - r); undefined beyond 36 reps so it is clamped. */
export const brzycki = (w: number, r: number) => (r <= 0 ? 0 : r <= 1 ? w : (w * 36) / (37 - Math.min(r, 36)));
/** Blend of both formulas. */
export const estimate1RM = (w: number, r: number) => (w <= 0 || r <= 0 ? 0 : (epley(w, r) + brzycki(w, r)) / 2);

export const PERCENT_STEPS = [100, 95, 90, 85, 80, 75, 70, 65, 60, 50];
/** Approximate reps achievable at each percentage (inverse Epley). */
export const repsAtPercent = (pct: number) => (pct >= 100 ? 1 : Math.max(1, Math.round(30 * (100 / pct - 1))));
export const percentChart = (oneRm: number) => PERCENT_STEPS.map((pct) => ({ pct, weight: (oneRm * pct) / 100, reps: repsAtPercent(pct) }));
