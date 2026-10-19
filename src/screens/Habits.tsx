import { Flame, Pencil, Plus, Snowflake, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DateStrip } from '../components/DateStrip';
import { HabitControl } from '../components/HabitControl';
import { HabitHeatmap } from '../components/HabitHeatmap';
import { Button, Card, Empty, IconButton, Led, Progress, Ring, Segmented, Select } from '../components/ui';
import { fmtTime12, relativeLabel } from '../lib/dates';
import { FREEZES_PER_MONTH, checkinsOf, effectiveTarget, freezeCount, isScheduledOn, slotsFor, streakOf } from '../repo/habitRepository';
import { dayRate } from '../repo/habitRepository';
import { useAppStore } from '../store/useAppStore';
import { useUIStore } from '../store/useUIStore';
import type { Habit } from '../db/types';
import { cx } from '../lib/util';

function HabitCard({ habit, date }: { habit: Habit; date: string }) {
  const logs = useAppStore((s) => s.habitLogs);
  const open = useUIStore((s) => s.open);
  const { habitSlot, habitFreeze } = useAppStore.getState();
  const log = logs.find((l) => l.habitId === habit.id && l.date === date);
  const streak = useMemo(() => streakOf(habit), [habit, logs]);
  const slots = slotsFor(habit);
  const target = effectiveTarget(habit);
  const progress = Math.min(1, (log?.value ?? 0) / target);
  const left = FREEZES_PER_MONTH - freezeCount(habit, date);
  const checked = checkinsOf(log);
  return (
    <Card screws style={{ padding: 18 }}>
      <div className="row">
        <span className="housing" style={{ color: habit.color, fontSize: 22 }} aria-hidden>{habit.icon}</span>
        <div className="grow">
          <strong className="truncate" style={{ display: 'block' }}>{habit.name}</strong>
          <div className="tiny muted row" style={{ gap: 8 }}>
            <span className="row num" style={{ gap: 3, color: streak.current ? 'var(--orange)' : undefined }}><Flame size={12} /> {streak.current}d</span>
            <span className="row num" style={{ gap: 3 }}><Trophy size={12} /> best {streak.best}d</span>
          </div>
        </div>
        <IconButton sm label="Edit habit" onClick={() => open('habit', { id: habit.id })}><Pencil size={16} /></IconButton>
      </div>
      <div className="row" style={{ marginTop: 14 }}>
        <div className="grow"><Progress value={progress} tone={log?.completed ? 'ok' : undefined} /></div>
        {!slots.length && <HabitControl habit={habit} date={date} />}
        {slots.length > 0 && <span className="num small" style={{ fontWeight: 700 }}>{log?.value ?? 0}/{slots.length}</span>}
      </div>
      {slots.length > 0 && !log?.isFrozen && (
        <div className="row wrap" style={{ marginTop: 12, gap: 8 }}>
          {slots.map((s) => (
            <button key={s} type="button" className="pill" aria-pressed={checked.includes(s)} onClick={() => habitSlot(habit.id, date, s)}>
              <span className="num">{fmtTime12(s)}</span>
            </button>
          ))}
        </div>
      )}
      <div className="row between" style={{ marginTop: 12 }}>
        {log?.isFrozen ? <span className="tag ok row" style={{ gap: 4 }}><Snowflake size={12} /> Streak protected</span> : <span className="tiny muted">{left} freeze{left === 1 ? '' : 's'} left this month</span>}
        <Button sm className={cx(log?.isFrozen && 'on')} onClick={() => habitFreeze(habit.id, date)} disabled={!log?.isFrozen && (left <= 0 || !!log?.completed)} aria-label="Freeze streak for this day">
          <Snowflake size={14} /> {log?.isFrozen ? 'Unfreeze' : 'Freeze day'}
        </Button>
      </div>
    </Card>
  );
}

export function HabitsScreen() {
  const date = useUIStore((s) => s.selectedDate);
  const setDate = useUIStore((s) => s.setDate);
  const open = useUIStore((s) => s.open);
  const habits = useAppStore((s) => s.habits);
  const logs = useAppStore((s) => s.habitLogs);
  const [days, setDays] = useState<'90' | '180' | '365'>('90');
  const [heatHabit, setHeatHabit] = useState('');
  const active = habits.filter((h) => !h.archived);
  const todays = active.filter((h) => isScheduledOn(h, date));
  const later = active.filter((h) => !isScheduledOn(h, date));
  const archived = habits.filter((h) => h.archived);
  const rate = useMemo(() => dayRate(date), [date, habits, logs]);
  const pct = rate.total ? rate.done / rate.total : 0;

  return (
    <main className="screen">
      <header className="screen-head">
        <div><div className="row"><Led /><span className="label">Behavior engine</span></div><h1>Habits</h1></div>
        <Button variant="primary" onClick={() => open('habit')}><Plus size={16} /> Habit</Button>
      </header>

      <Card dark screws>
        <div className="row" style={{ gap: 16 }}>
          <Ring value={pct} size={84} stroke={10} track="#454d50"><span className="num" style={{ fontWeight: 700, fontSize: '1.1rem' }}>{Math.round(pct * 100)}%</span></Ring>
          <div className="grow">
            <div className="label">{relativeLabel(date)} · completion</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.03em' }}>{rate.done} of {rate.total} habits</div>
            <div className="small" style={{ color: '#a8b2d1' }}>Frozen days are excluded from the rate.</div>
          </div>
        </div>
      </Card>

      <DateStrip value={date} onChange={setDate} />

      {active.length === 0 && <Empty title="No habits yet" text="Build streaks with single, counted, timed or multi-check-in habits." action={<Button variant="primary" onClick={() => open('habit')}><Plus size={16} /> Create habit</Button>} />}
      {todays.map((h) => <HabitCard key={h.id} habit={h} date={date} />)}
      {later.length > 0 && (
        <>
          <span className="label">Not scheduled on this day</span>
          {later.map((h) => <Card key={h.id} style={{ padding: 12 }} onClick={() => open('habit', { id: h.id })}><div className="row"><span style={{ fontSize: 20 }}>{h.icon}</span><span className="grow muted">{h.name}</span><span className="tag">{h.frequency}</span></div></Card>)}
        </>
      )}

      <Card screws vents>
        <div className="col" style={{ gap: 14 }}>
          <h2 className="h2">Consistency heatmap</h2>
          <Segmented<'90' | '180' | '365'> value={days} onChange={setDays} options={[{ value: '90', label: '90 days' }, { value: '180', label: '180 days' }, { value: '365', label: '1 year' }]} />
          <Select value={heatHabit} onChange={(e) => setHeatHabit(e.target.value)} aria-label="Heatmap habit">
            <option value="">All habits</option>
            {active.map((h) => <option key={h.id} value={h.id}>{h.icon} {h.name}</option>)}
          </Select>
          <HabitHeatmap habitId={heatHabit || null} days={Number(days)} />
        </div>
      </Card>

      {archived.length > 0 && (
        <details>
          <summary className="label" style={{ cursor: 'pointer', padding: 8 }}>Archived ({archived.length})</summary>
          {archived.map((h) => <Card key={h.id} style={{ padding: 12, marginTop: 8 }} onClick={() => open('habit', { id: h.id })}>{h.icon} {h.name}</Card>)}
        </details>
      )}
    </main>
  );
}
