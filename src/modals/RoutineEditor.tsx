import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { DayChips } from '../components/DayChips';
import { Button, Card, Field, IconButton, NumInput, Select, Sheet, TextArea, TextInput, Toggle } from '../components/ui';
import { FOLDERS } from '../data/programs';
import { todayStr } from '../lib/dates';
import { getRoutineFull, routineToDraft, saveRoutine, type RoutineDraft } from '../repo/workoutRepository';
import { useUIStore } from '../store/useUIStore';
import { useWorkoutStore } from '../store/useWorkoutStore';

export function RoutineEditor({ id }: { id?: string }) {
  const close = useUIStore((s) => s.close);
  const open = useUIStore((s) => s.open);
  const toast = useUIStore((s) => s.toast);
  const exercises = useWorkoutStore((s) => s.exercises);
  const [d, setD] = useState<RoutineDraft>(() => {
    const full = id ? getRoutineFull(id) : undefined;
    return full ? routineToDraft(full) : { name: '', description: '', folder: 'Hypertrophy', isDeload: false, scheduleDays: [1, 3, 5], startDate: todayStr(), days: [{ dayName: 'Day 1', exercises: [] }] };
  });
  const patchDay = (i: number, fn: (day: RoutineDraft['days'][number]) => RoutineDraft['days'][number]) => setD((p) => ({ ...p, days: p.days.map((x, j) => (j === i ? fn(x) : x)) }));
  const move = <T,>(arr: T[], i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= arr.length) return arr; const c = [...arr]; [c[i], c[j]] = [c[j], c[i]]; return c; };

  const save = () => {
    if (!d.name.trim()) { toast('Name your routine', { tone: 'warn' }); return; }
    if (!d.days.length) { toast('Add at least one day', { tone: 'warn' }); return; }
    if (!d.scheduleDays.length) { toast('Pick at least one training weekday', { tone: 'warn' }); return; }
    saveRoutine(d);
    toast('Routine saved', { tone: 'success' });
    close('routine');
  };

  return (
    <Sheet title={id ? 'Edit routine' : 'New routine'} onClose={() => close('routine')} full footer={<Button block variant="primary" onClick={save}>Save routine</Button>}>
      <Field label="Name"><TextInput value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="e.g. Upper / Lower" /></Field>
      <Field label="Description"><TextArea style={{ minHeight: 70 }} value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} /></Field>
      <div className="grid2">
        <Field label="Folder"><Select value={d.folder} onChange={(e) => setD({ ...d, folder: e.target.value })}>{FOLDERS.filter((f) => f !== 'All').map((f) => <option key={f}>{f}</option>)}</Select></Field>
        <Field label="Cycle starts"><TextInput type="date" value={d.startDate ?? ''} onChange={(e) => setD({ ...d, startDate: e.target.value || todayStr() })} /></Field>
      </div>
      <Field label="Training weekdays" hint="Days rotate in order across these weekdays. Skipping a day rolls it forward."><DayChips value={d.scheduleDays} onChange={(v) => setD({ ...d, scheduleDays: v })} /></Field>
      <div className="row between"><span>Deload routine</span><Toggle label="Deload routine" checked={d.isDeload} onChange={(v) => setD({ ...d, isDeload: v })} /></div>

      {d.days.map((day, i) => (
        <Card key={i} screws>
          <div className="col" style={{ gap: 12 }}>
            <div className="row">
              <div className="grow"><TextInput aria-label="Day name" value={day.dayName} onChange={(e) => patchDay(i, (x) => ({ ...x, dayName: e.target.value }))} /></div>
              <IconButton sm label="Move day up" onClick={() => setD({ ...d, days: move(d.days, i, -1) })}><ArrowUp size={16} /></IconButton>
              <IconButton sm label="Move day down" onClick={() => setD({ ...d, days: move(d.days, i, 1) })}><ArrowDown size={16} /></IconButton>
              <IconButton sm label="Remove day" onClick={() => setD({ ...d, days: d.days.filter((_, j) => j !== i) })}><Trash2 size={16} /></IconButton>
            </div>
            {day.exercises.map((ex, k) => (
              <div key={k} className="col" style={{ gap: 8, paddingBottom: 12, borderBottom: '1px solid var(--recessed)' }}>
                <div className="row">
                  <strong className="grow">{exercises.find((e) => e.id === ex.exerciseId)?.name ?? 'Exercise'}</strong>
                  <IconButton sm label="Move up" onClick={() => patchDay(i, (x) => ({ ...x, exercises: move(x.exercises, k, -1) }))}><ArrowUp size={14} /></IconButton>
                  <IconButton sm label="Move down" onClick={() => patchDay(i, (x) => ({ ...x, exercises: move(x.exercises, k, 1) }))}><ArrowDown size={14} /></IconButton>
                  <IconButton sm label="Remove exercise" onClick={() => patchDay(i, (x) => ({ ...x, exercises: x.exercises.filter((_, j) => j !== k) }))}><Trash2 size={14} /></IconButton>
                </div>
                <div className="grid3" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                  {([['sets', 'Sets'], ['reps', 'Reps'], ['weight', 'Kg'], ['rest', 'Rest s']] as const).map(([key, label]) => (
                    <label key={key} className="field" style={{ gap: 3 }}>
                      <span className="label" style={{ fontSize: '0.6rem' }}>{label}</span>
                      <NumInput value={ex[key]} label={label} onChange={(n) => patchDay(i, (x) => ({ ...x, exercises: x.exercises.map((y, j) => (j === k ? { ...y, [key]: key === 'weight' ? n : Math.max(key === 'rest' ? 0 : 1, Math.round(n)) } : y)) }))} />
                    </label>
                  ))}
                  <label className="field" style={{ gap: 3 }}>
                    <span className="label" style={{ fontSize: '0.6rem' }}>Super</span>
                    <input className="input compact" maxLength={3} placeholder="A1" aria-label="Superset group" value={ex.supersetGroup ?? ''} onChange={(e) => patchDay(i, (x) => ({ ...x, exercises: x.exercises.map((y, j) => (j === k ? { ...y, supersetGroup: e.target.value.toUpperCase() } : y)) }))} />
                  </label>
                </div>
              </div>
            ))}
            <Button sm onClick={() => open('exercisePicker', { onPick: (eid: string) => patchDay(i, (x) => ({ ...x, exercises: [...x.exercises, { exerciseId: eid, sets: 3, reps: 10, weight: 0, rest: 90, supersetGroup: null }] })) })}>
              <Plus size={14} /> Add exercise
            </Button>
          </div>
        </Card>
      ))}
      <Button onClick={() => setD({ ...d, days: [...d.days, { dayName: `Day ${d.days.length + 1}`, exercises: [] }] })}><Plus size={16} /> Add day</Button>
    </Sheet>
  );
}
