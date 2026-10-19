import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { DayChips } from '../components/DayChips';
import { Button, Field, NumberStepper, Segmented, Select, Sheet, TextInput } from '../components/ui';
import type { HabitFrequency, HabitType, ScheduleConfig, ScheduleType } from '../db/types';
import { configOf, createHabit, slotsFor, updateHabit } from '../repo/habitRepository';
import { useAppStore } from '../store/useAppStore';
import { useUIStore } from '../store/useUIStore';

const ICONS = ['💧', '🧘', '📚', '💊', '🏃', '🥗', '😴', '🕯️', '✍️', '🧠', '🦷', '🥤', '🚶', '🎸', '🌿', '☀️'];
const COLORS = ['#ff4757', '#2f6fed', '#27a860', '#8b5cf6', '#f59e0b', '#06b6d4', '#f26b1d', '#4a5568'];

export function HabitEditor({ id }: { id?: string }) {
  const close = useUIStore((s) => s.close);
  const toast = useUIStore((s) => s.toast);
  const habits = useAppStore((s) => s.habits);
  const existing = habits.find((h) => h.id === id);
  const cfg = existing ? configOf(existing) : ({} as ScheduleConfig);
  const [f, setF] = useState(() => ({
    name: existing?.name ?? '', icon: existing?.icon ?? '💧', color: existing?.color ?? '#ff4757', type: (existing?.type ?? 'boolean') as HabitType,
    target: existing?.target ?? 1, unit: existing?.unit ?? '', frequency: (existing?.frequency ?? 'daily') as HabitFrequency,
    customDays: cfg.customDays ?? [1, 3, 5], reminderTime: existing?.reminderTime ?? '', scheduleType: (existing?.scheduleType ?? 'none') as ScheduleType,
    fixedTimes: (cfg.fixedTimes ?? ['08:00', '13:00', '18:00']).join(', '), intervalHours: cfg.intervalHours ?? 2, startHour: cfg.startHour ?? 8, endHour: cfg.endHour ?? 22,
    chainedHabitId: existing?.chainedHabitId ?? '',
  }));
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const fixedList = f.fixedTimes.split(/[,\s]+/).filter((t) => /^\d{1,2}:\d{2}$/.test(t)).map((t) => t.padStart(5, '0'));
  const preview = (() => {
    if (f.scheduleType === 'none') return [];
    const fake = { ...(existing ?? ({} as never)), scheduleType: f.scheduleType, scheduleConfig: JSON.stringify({ fixedTimes: fixedList, intervalHours: f.intervalHours, startHour: f.startHour, endHour: f.endHour }) } as never;
    return slotsFor(fake);
  })();

  const save = () => {
    if (!f.name.trim()) { toast('Name your habit', { tone: 'warn' }); return; }
    if (f.scheduleType === 'fixed' && !fixedList.length) { toast('Enter at least one check-in time (HH:mm)', { tone: 'warn' }); return; }
    if (f.scheduleType === 'interval' && f.endHour < f.startHour) { toast('End hour must be after start hour', { tone: 'warn' }); return; }
    const config: ScheduleConfig = {};
    if (f.frequency === 'custom') config.customDays = f.customDays;
    if (f.scheduleType === 'fixed') config.fixedTimes = fixedList;
    if (f.scheduleType === 'interval') Object.assign(config, { intervalHours: f.intervalHours, startHour: f.startHour, endHour: f.endHour });
    const payload = {
      name: f.name, icon: f.icon, color: f.color, type: f.type, target: f.type === 'boolean' ? 1 : f.target, unit: f.type === 'boolean' ? '' : f.unit || (f.type === 'duration' ? 'min' : 'times'),
      frequency: f.frequency, reminderTime: f.reminderTime || null, scheduleType: f.scheduleType, scheduleConfig: Object.keys(config).length ? JSON.stringify(config) : null,
      chainedHabitId: f.chainedHabitId || null,
    };
    if (existing) updateHabit(existing.id, payload); else createHabit(payload);
    toast(existing ? 'Habit updated' : 'Habit created', { tone: 'success' });
    close('habit');
  };

  return (
    <Sheet title={existing ? 'Edit habit' : 'New habit'} onClose={() => close('habit')}
      footer={<>
        {existing && <Button aria-label="Delete habit" onClick={() => { useAppStore.getState().removeHabit(existing.id); close('habit'); toast('Habit deleted'); }}><Trash2 size={16} /></Button>}
        {existing && <Button onClick={() => { updateHabit(existing.id, { archived: existing.archived ? 0 : 1 }); close('habit'); }}>{existing.archived ? 'Unarchive' : 'Archive'}</Button>}
        <Button block variant="primary" onClick={save}>Save</Button>
      </>}>
      <Field label="Name"><TextInput autoFocus={!existing} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Drink water" /></Field>
      <div className="field"><span className="label">Icon</span>
        <div className="row wrap" style={{ gap: 8 }}>{ICONS.map((i) => <button key={i} type="button" className="pill" aria-pressed={f.icon === i} style={{ width: 46, height: 46, padding: 0, justifyContent: 'center', fontSize: 20 }} onClick={() => set('icon', i)}>{i}</button>)}</div>
      </div>
      <div className="field"><span className="label">Color</span>
        <div className="row wrap" style={{ gap: 10 }}>{COLORS.map((c) => <button key={c} type="button" aria-label={`Color ${c}`} aria-pressed={f.color === c} onClick={() => set('color', c)} style={{ width: 36, height: 36, borderRadius: 9999, background: c, boxShadow: f.color === c ? `0 0 0 3px var(--chassis), 0 0 0 5px ${c}` : 'var(--shadow-card-sm)' }} />)}</div>
      </div>
      <Field label="Tracking type"><Segmented<HabitType> value={f.type} onChange={(v) => { set('type', v); if (v === 'duration' && f.target < 5) set('target', 10); if (v === 'counter' && f.target < 2) set('target', 8); }} options={[{ value: 'boolean', label: 'Yes / No' }, { value: 'counter', label: 'Counter' }, { value: 'duration', label: 'Duration' }]} /></Field>
      {f.type !== 'boolean' && f.scheduleType === 'none' && (
        <div className="grid2">
          <Field label="Daily target"><NumberStepper value={f.target} onChange={(n) => set('target', n)} min={1} step={f.type === 'duration' ? 5 : 1} width={64} /></Field>
          <Field label="Unit"><TextInput value={f.unit} onChange={(e) => set('unit', e.target.value)} placeholder={f.type === 'duration' ? 'min' : 'glasses'} /></Field>
        </div>
      )}
      <Field label="Frequency"><Segmented<HabitFrequency> value={f.frequency} onChange={(v) => set('frequency', v)} options={[{ value: 'daily', label: 'Daily' }, { value: 'weekdays', label: 'Weekdays' }, { value: 'custom', label: 'Custom' }]} /></Field>
      {f.frequency === 'custom' && <Field label="On days"><DayChips value={f.customDays} onChange={(v) => set('customDays', v)} /></Field>}
      <Field label="Check-in schedule" hint="Multiple check-ins per day each appear on the Today timeline.">
        <Segmented<ScheduleType> value={f.scheduleType} onChange={(v) => set('scheduleType', v)} options={[{ value: 'none', label: 'Single' }, { value: 'fixed', label: 'Fixed times' }, { value: 'interval', label: 'Interval' }]} />
      </Field>
      {f.scheduleType === 'fixed' && <Field label="Times (HH:mm, comma separated)"><TextInput value={f.fixedTimes} onChange={(e) => set('fixedTimes', e.target.value)} placeholder="08:00, 13:00, 18:00" /></Field>}
      {f.scheduleType === 'interval' && (
        <div className="grid3">
          <Field label="Every (h)"><NumberStepper value={f.intervalHours} onChange={(n) => set('intervalHours', n)} min={1} max={12} width={44} /></Field>
          <Field label="From (h)"><NumberStepper value={f.startHour} onChange={(n) => set('startHour', n)} min={0} max={23} width={44} /></Field>
          <Field label="Until (h)"><NumberStepper value={f.endHour} onChange={(n) => set('endHour', n)} min={0} max={23} width={44} /></Field>
        </div>
      )}
      {preview.length > 0 && <div className="row wrap" style={{ gap: 6 }}>{preview.map((p) => <span key={p} className="tag num">{p}</span>)}</div>}
      {f.scheduleType === 'none' && <Field label="Reminder time (optional)"><TextInput type="time" value={f.reminderTime} onChange={(e) => set('reminderTime', e.target.value)} /></Field>}
      <Field label="Routine anchor — next habit" hint="When this habit is completed, a banner prompts the chained habit.">
        <Select value={f.chainedHabitId} onChange={(e) => set('chainedHabitId', e.target.value)}>
          <option value="">None</option>
          {habits.filter((h) => h.id !== existing?.id && !h.archived).map((h) => <option key={h.id} value={h.id}>{h.icon} {h.name}</option>)}
        </Select>
      </Field>
    </Sheet>
  );
}
