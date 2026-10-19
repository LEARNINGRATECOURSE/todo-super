import { Lock, Plus } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, Field, Housing, NamedIcon, NumInput, Progress, Segmented, Sheet, TextInput } from '../components/ui';
import { addDays, fmtShort, todayStr } from '../lib/dates';
import { createChallenge } from '../repo/workoutRepository';
import { useUIStore } from '../store/useUIStore';
import { useWorkoutStore } from '../store/useWorkoutStore';

export function AchievementsModal() {
  const close = useUIStore((s) => s.close);
  const toast = useUIStore((s) => s.toast);
  const achievements = useWorkoutStore((s) => s.achievements);
  const challenges = useWorkoutStore((s) => s.challenges);
  const [adding, setAdding] = useState(false);
  const [c, setC] = useState({ title: '', kind: 'sessions' as 'sessions' | 'volume', target: 12, deadline: addDays(todayStr(), 30) });
  const unlocked = achievements.filter((a) => a.unlockedAt);
  const sorted = [...achievements].sort((a, b) => Number(!!b.unlockedAt) - Number(!!a.unlockedAt));
  return (
    <Sheet title="Achievements" onClose={() => close('achievements')}>
      <div className="row between"><span className="label">Badges</span><span className="num small"><strong>{unlocked.length}</strong>/{achievements.length}</span></div>
      <div className="grid2">
        {sorted.map((a) => (
          <Card key={a.id} style={{ padding: 14, opacity: a.unlockedAt ? 1 : 0.6 }}>
            <div className="col" style={{ gap: 8, alignItems: 'flex-start' }}>
              <Housing color={a.unlockedAt ? 'var(--accent)' : 'var(--muted)'}>{a.unlockedAt ? <NamedIcon name={a.icon} /> : <Lock size={18} />}</Housing>
              <strong style={{ fontSize: '0.95rem' }}>{a.title}</strong>
              <span className="tiny muted">{a.description}</span>
              {a.unlockedAt && <span className="tag ok">{fmtShort(a.unlockedAt.slice(0, 10))}</span>}
            </div>
          </Card>
        ))}
      </div>
      <div className="row between"><span className="label">Challenges</span><Button sm onClick={() => setAdding((a) => !a)}><Plus size={14} /> New</Button></div>
      {adding && (
        <Card recessed className="col">
          <Field label="Title"><TextInput value={c.title} onChange={(e) => setC({ ...c, title: e.target.value })} placeholder="e.g. 10 workouts this month" /></Field>
          <Segmented value={c.kind} onChange={(kind) => setC({ ...c, kind, target: kind === 'volume' ? 50000 : 12 })} options={[{ value: 'sessions', label: 'Workouts' }, { value: 'volume', label: 'Volume (kg)' }]} />
          <div className="grid2">
            <Field label="Target"><NumInput compact={false} value={c.target} onChange={(n) => setC({ ...c, target: n })} /></Field>
            <Field label="Deadline"><TextInput type="date" value={c.deadline} onChange={(e) => setC({ ...c, deadline: e.target.value })} /></Field>
          </div>
          <p className="tiny muted">Counts workouts in the 30 days before the deadline.</p>
          <Button variant="primary" onClick={() => { if (!c.title.trim() || c.target <= 0) { toast('Add a title and target', { tone: 'warn' }); return; } createChallenge(c); setAdding(false); setC({ ...c, title: '' }); }}>Create challenge</Button>
        </Card>
      )}
      {challenges.map((ch) => (
        <Card key={ch.id} screws>
          <div className="col" style={{ gap: 8 }}>
            <div className="row"><Housing sm><NamedIcon name={ch.icon} size={18} /></Housing><div className="grow"><strong>{ch.title}</strong><div className="tiny muted">{ch.description} · by {fmtShort(ch.deadline)}</div></div>{ch.completed ? <span className="tag ok">Done</span> : null}</div>
            <Progress value={ch.currentValue / ch.targetValue} tone={ch.completed ? 'ok' : undefined} />
            <span className="num tiny muted">{ch.currentValue.toLocaleString()} / {ch.targetValue.toLocaleString()} {ch.unit === 'kg' ? 'kg' : ch.unit}</span>
          </div>
        </Card>
      ))}
    </Sheet>
  );
}
