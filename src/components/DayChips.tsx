import { DAY_LETTERS, DAY_SHORT } from '../lib/dates';

/** Weekday multi-select (0 = Sunday). Rendered Monday-first. */
export function DayChips({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <div className="row" style={{ gap: 6 }} role="group" aria-label="Days of week">
      {order.map((d) => {
        const on = value.includes(d);
        return (
          <button key={d} type="button" className="pill" aria-pressed={on} aria-label={DAY_SHORT[d]}
            style={{ minWidth: 40, padding: 0, justifyContent: 'center', height: 44, flex: 1 }}
            onClick={() => onChange(on ? value.filter((x) => x !== d) : [...value, d].sort())}>{DAY_LETTERS[d]}</button>
        );
      })}
    </div>
  );
}
