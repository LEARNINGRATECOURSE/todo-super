import { db } from '../db/database';
import type { Unit } from '../lib/units';

export const getSetting = (key: string, fallback = ''): string => db.get('app_settings', key)?.value ?? fallback;
export const setSetting = (key: string, value: string) => void db.insert('app_settings', { key, value });
export const getBool = (key: string, fallback = false) => {
  const v = db.get('app_settings', key)?.value;
  return v === undefined ? fallback : v === '1';
};
export const setBool = (key: string, v: boolean) => setSetting(key, v ? '1' : '0');
export const getUnit = (): Unit => (getSetting('unit', 'kg') === 'lb' ? 'lb' : 'kg');
