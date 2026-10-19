import { db } from '../db/database';

export const uid = (prefix = '') =>
  prefix + (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().replace(/-/g, '').slice(0, 16) : Math.random().toString(36).slice(2, 10) + Date.now().toString(36));

export const parseJSON = <T,>(s: string | null | undefined, fallback: T): T => {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
};
export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
export const avg = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);
export const round1 = (n: number) => Math.round(n * 10) / 10;
export const cx = (...c: (string | false | 0 | null | undefined)[]) => c.filter(Boolean).join(' ');
/** User preference: sound + vibration feedback (Settings). */
export const feedbackEnabled = () => db.get('app_settings', 'feedback')?.value !== '0';

export const haptic = (pattern: number | number[] = 12) => {
  if (!feedbackEnabled()) return;
  try {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  } catch {
    /* unsupported */
  }
};
export const groupBy = <T,>(xs: T[], key: (x: T) => string) => {
  const out: Record<string, T[]> = {};
  for (const x of xs) (out[key(x)] ||= []).push(x);
  return out;
};
