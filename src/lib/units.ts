export type Unit = 'kg' | 'lb';
export const KG_TO_LB = 2.20462;
export const convert = (w: number, from: Unit, to: Unit) => (from === to ? w : from === 'kg' ? w * KG_TO_LB : w / KG_TO_LB);
export const roundWeight = (w: number, unit: Unit) => {
  const step = unit === 'kg' ? 0.25 : 0.5;
  return Math.round(w / step) * step;
};
export const fmtWeight = (w: number) => (Math.round(w * 100) / 100).toString();
export const incrementFor = (unit: Unit) => (unit === 'kg' ? 2.5 : 5);
/** Display a stored weight (in its own unit) in the global unit, rounded to a sensible plate step. */
export const displayWeight = (w: number, stored: Unit, global: Unit) => fmtWeight(roundWeight(convert(w, stored, global), global));
