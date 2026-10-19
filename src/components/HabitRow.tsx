import { Flame } from 'lucide-react';
import { useMemo } from 'react';
import type { Habit } from '../db/types';
import { fmtTime12 } from '../lib/dates';
import { slotsFor, streakOf } from '../repo/habitRepository';
import { useAppStore } from '../store/useAppStore';
import { useUIStore } from '../store/useUIStore';
import { HabitControl } from './HabitControl';
import { Card } from './ui';

export function HabitRow({ habit, date, slot, compact }: { habit: Habit; date: string; slot?: string | null; compact?: boolean }) {
  const logs = useAppStore((s) => s.habitLogs);
  const open = useUIStore((s) => s.open);
  const streak = useMemo(() => streakOf(habit), [habit, logs]);
  const slots = slotsFor(habit);
  return (
    <Card className={compact ? undefined : 'press'} style={{ padding: 12 }}>
      <div className="row">
        <button type="button" className="housing sm" style={{ color: habit.color, fontSize: 18 }} aria-label={`Edit ${habit.name}`} onClick={() => open('habit', { id: habit.id })}>{habit.icon}</button>
        <div className="grow">
          <div style={{ fontWeight: 600 }} className="truncate">{habit.name}{slot ? <span className="num muted small"> · {fmtTime12(slot)}</span> : null}</div>
          <div className="tiny muted row" style={{ gap: 6 }}>
            <span>{habit.type === 'boolean' && !slots.length ? 'Daily check' : slots.length ? `${slots.length} check-ins/day` : `${habit.target} ${habit.unit}`}</span>
            {streak.current > 0 && <span className="row num" style={{ gap: 2, color: 'var(--orange)' }}><Flame size={12} /> {streak.current}</span>}
          </div>
        </div>
        <HabitControl habit={habit} date={date} slot={slot} />
      </div>
    </Card>
  );
}
