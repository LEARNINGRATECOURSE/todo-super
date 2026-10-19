import { useEffect, useMemo, useRef } from 'react';
import { DAY_SHORT, addDays, diffDays, parseDate, relativeLabel, todayStr } from '../lib/dates';

/** Continuous ±21-day horizontal strip centred on today; re-centres on the selected day when it falls outside that window (e.g. picked in the Calendar). */
export function DateStrip({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const today = todayStr();
  const base = Math.abs(diffDays(value, today)) > 21 ? value : today;
  const days = useMemo(() => Array.from({ length: 43 }, (_, i) => addDays(base, i - 21)), [base]);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const first = useRef(true);
  useEffect(() => {
    refs.current[value]?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: first.current ? 'auto' : 'smooth' });
    first.current = false;
  }, [value]);
  return (
    <div className="datestrip hide-scroll" role="group" aria-label="Select date">
      {days.map((d) => {
        const dt = parseDate(d);
        return (
          <button key={d} ref={(el) => { refs.current[d] = el; }} type="button" className="datechip" aria-pressed={d === value} onClick={() => onChange(d)} aria-label={relativeLabel(d, today)}>
            <span className="dow">{DAY_SHORT[dt.getDay()]}</span>
            <span className="dn">{dt.getDate()}</span>
            <span className="rel">{relativeLabel(d, today)}</span>
          </button>
        );
      })}
    </div>
  );
}
