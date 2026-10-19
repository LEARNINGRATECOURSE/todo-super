import { Plus, Search, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, Card, Field, IconButton, Pills, Select, Sheet, TextInput } from '../components/ui';
import { CATEGORIES, MUSCLES } from '../data/exercises';
import type { Exercise, ExerciseCategory, Muscle } from '../db/types';
import { createExercise, toggleFavorite } from '../repo/workoutRepository';
import { useUIStore } from '../store/useUIStore';
import { useWorkoutStore } from '../store/useWorkoutStore';

/** Multi-add exercise picker: stays open so several exercises can be added in a row. */
export function ExercisePicker({ onPick }: { onPick?: (id: string) => void }) {
  const close = useUIStore((s) => s.close);
  const toast = useUIStore((s) => s.toast);
  const all = useWorkoutStore((s) => s.exercises);
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<'All' | 'Favorites' | Muscle>('All');
  const [added, setAdded] = useState(0);
  const [creating, setCreating] = useState(false);
  const [nu, setNu] = useState<{ name: string; muscle: Muscle; category: ExerciseCategory }>({ name: '', muscle: 'Chest', category: 'Barbell' });

  const list = useMemo(() => all
    .filter((e) => (muscle === 'All' ? true : muscle === 'Favorites' ? e.isFavorite : e.muscle === muscle))
    .filter((e) => !q || e.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.isFavorite - a.isFavorite || a.name.localeCompare(b.name)), [all, q, muscle]);

  const pick = (e: Exercise) => { onPick?.(e.id); setAdded((n) => n + 1); toast(`Added ${e.name}`, { tone: 'success' }); };

  return (
    <Sheet title="Add exercises" onClose={() => close('exercisePicker')} z={70} footer={<Button block variant="primary" onClick={() => close('exercisePicker')}>Done{added ? ` (${added} added)` : ''}</Button>}>
      <div style={{ position: 'relative' }}>
        <Search size={18} style={{ position: 'absolute', left: 16, top: 19, color: 'var(--muted)' }} />
        <TextInput placeholder="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 44 }} aria-label="Search exercises" />
      </div>
      <Pills options={['All', 'Favorites', ...MUSCLES] as readonly string[]} value={muscle} onChange={(v) => setMuscle(v as typeof muscle)} />
      <Button onClick={() => setCreating((c) => !c)}><Plus size={16} /> Custom exercise</Button>
      {creating && (
        <Card recessed className="col">
          <Field label="Name"><TextInput value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} /></Field>
          <div className="grid2">
            <Field label="Muscle"><Select value={nu.muscle} onChange={(e) => setNu({ ...nu, muscle: e.target.value as Muscle })}>{MUSCLES.map((m) => <option key={m}>{m}</option>)}</Select></Field>
            <Field label="Type"><Select value={nu.category} onChange={(e) => setNu({ ...nu, category: e.target.value as ExerciseCategory })}>{CATEGORIES.map((m) => <option key={m}>{m}</option>)}</Select></Field>
          </div>
          <Button variant="primary" onClick={() => { if (!nu.name.trim()) return; const ex = createExercise(nu); setCreating(false); setNu({ ...nu, name: '' }); pick(ex); }}>Create & add</Button>
        </Card>
      )}
      {list.map((e) => (
        <div key={e.id} className="row">
          <button type="button" className="task grow" style={{ textAlign: 'left', minHeight: 56 }} onClick={() => pick(e)}>
            <div className="grow"><strong>{e.name}</strong><div className="tiny muted">{e.muscle} · {e.category}{e.isCustom ? ' · custom' : ''}</div></div>
            <Plus size={18} className="accent" />
          </button>
          <IconButton sm label={e.isFavorite ? 'Unfavorite' : 'Favorite'} on={!!e.isFavorite} onClick={() => toggleFavorite(e.id)}><Star size={16} fill={e.isFavorite ? 'currentColor' : 'none'} /></IconButton>
        </div>
      ))}
      {list.length === 0 && <span className="muted small">No matches. Create a custom exercise above.</span>}
    </Sheet>
  );
}
