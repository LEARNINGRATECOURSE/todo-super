import { Check, Minus, Plus, Snowflake } from 'lucide-react';
import type { Habit } from '../db/types';
import { cx } from '../lib/util';
import { checkinsOf, effectiveTarget, logFor, slotsFor } from '../repo/habitRepository';
import { useAppStore } from '../store/useAppStore';
import { IconButton } from './ui';

/** Per-habit quick control. For slotted habits, pass `slot` to render that single check-in. */
export function HabitControl({ habit, date, slot }: { habit: Habit; date: string; slot?: string | null }) {
  const logs = useAppStore((s) => s.habitLogs);
  const { habitToggle, habitSlot, habitSet } = useAppStore.getState();
  const log = logs.find((l) => l.habitId === habit.id && l.date === date) ?? logFor(habit.id, date);
  const frozen = !!log?.isFrozen;
  const value = log?.value ?? 0;
  const slots = slotsFor(habit);

  if (frozen) return <span className="tag ok row" style={{ gap: 4 }}><Snowflake size={12} /> Frozen</span>;

  if (slot) {
    const done = checkinsOf(log).includes(slot);
    return (
      <button type="button" className={cx('check', done && 'on')} aria-pressed={done} aria-label={`Check in ${habit.name} at ${slot}`} onClick={() => habitSlot(habit.id, date, slot)}>
        <Check size={18} strokeWidth={3} />
      </button>
    );
  }
  if (slots.length) {
    return <span className="num small">{value}/{slots.length}</span>;
  }
  if (habit.type === 'boolean') {
    return (
      <button type="button" className={cx('check', log?.completed && 'on')} aria-pressed={!!log?.completed} aria-label={`Toggle ${habit.name}`} onClick={() => habitToggle(habit.id, date)}>
        <Check size={18} strokeWidth={3} />
      </button>
    );
  }
  const step = habit.type === 'duration' ? 5 : 1;
  const target = effectiveTarget(habit);
  return (
    <div className="row" style={{ gap: 6 }}>
      <IconButton sm label="Decrease" onClick={() => habitSet(habit.id, date, value - step)}><Minus size={16} /></IconButton>
      <span className="num small" style={{ minWidth: 54, textAlign: 'center', fontWeight: 700, color: log?.completed ? 'var(--ok)' : undefined }}>{value}/{target}</span>
      <IconButton sm label="Increase" onClick={() => habitSet(habit.id, date, value + step)}><Plus size={16} /></IconButton>
    </div>
  );
}
