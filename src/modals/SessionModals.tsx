import { Trash2, Trophy } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, Confirm, Sheet, Tag } from '../components/ui';
import { fmtClock, fmtLong } from '../lib/dates';
import { convert, displayWeight } from '../lib/units';
import { groupBy } from '../lib/util';
import { deleteSession } from '../repo/workoutRepository';
import { useUnit } from '../store/useAppStore';
import { useUIStore } from '../store/useUIStore';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { SET_TYPE_LABEL } from '../store/useWorkoutStore';

export function SessionDetail({ id }: { id: string }) {
  const close = useUIStore((s) => s.close);
  const unit = useUnit();
  const session = useWorkoutStore((s) => s.sessions).find((x) => x.id === id);
  const exercises = useWorkoutStore((s) => s.exercises);
  const allSets = useWorkoutStore((s) => s.sets);
  const [confirm, setConfirm] = useState(false);
  if (!session) return null;
  const sets = allSets.filter((s) => s.sessionId === id).sort((a, b) => a.setNumber - b.setNumber);
  const groups = groupBy(sets, (s) => s.exerciseId);
  return (
    <Sheet title={session.dayName ?? session.routineName ?? 'Workout'} onClose={() => close('sessionDetail')} footer={<Button block onClick={() => setConfirm(true)}><Trash2 size={16} /> Delete session</Button>}>
      <div className="row wrap" style={{ gap: 8 }}>
        <Tag>{fmtLong(session.date)}</Tag><Tag>{fmtClock(session.duration)}</Tag><Tag>Fatigue {session.fatigueRating}/5</Tag>{session.isDeload ? <Tag tone="hot">Deload</Tag> : null}
      </div>
      <Card dark><div className="label">Total volume</div><div className="num" style={{ fontSize: '2rem', fontWeight: 700 }}>{Math.round(convert(session.totalVolume, session.unit, unit)).toLocaleString()} {unit}</div></Card>
      {Object.entries(groups).map(([exId, list]) => (
        <Card key={exId} style={{ padding: 14 }}>
          <strong>{exercises.find((e) => e.id === exId)?.name ?? 'Exercise'}</strong>
          <div className="col" style={{ gap: 4, marginTop: 8 }}>
            {list.map((s, i) => (
              <div key={s.id} className="row small num">
                <span className="tag" style={{ width: 30, justifyContent: 'center' }}>{s.setType === 'normal' ? i + 1 : SET_TYPE_LABEL[s.setType]}</span>
                {s.weightType === 'cardio'
                  ? <span className="grow">{Math.round((s.timeSeconds ?? 0) / 60)} min · {s.distance ?? 0} km</span>
                  : <span className="grow">{displayWeight(s.weight, session.unit, unit)} {unit} × {s.reps}{s.weightType === 'bodyweight' ? ' (BW+)' : s.weightType === 'assisted' ? ' (assisted)' : ''}</span>}
                {s.rpe != null && <span className="muted">RPE {s.rpe}</span>}
                {s.rir != null && <span className="muted">RIR {s.rir}</span>}
              </div>
            ))}
          </div>
        </Card>
      ))}
      {session.notes && <Card recessed><span className="label">Notes</span><p className="small">{session.notes}</p></Card>}
      {confirm && <Confirm title="Delete session?" text="Its sets are removed and records recalculate." onConfirm={() => { deleteSession(id); close('sessionDetail'); }} onClose={() => setConfirm(false)} />}
    </Sheet>
  );
}

export function WorkoutSummary({ id, prs }: { id: string; prs?: string[] }) {
  const close = useUIStore((s) => s.close);
  const unit = useUnit();
  const session = useWorkoutStore((s) => s.sessions).find((x) => x.id === id);
  const sets = useWorkoutStore((s) => s.sets).filter((s) => s.sessionId === id);
  if (!session) return null;
  return (
    <Sheet title="Workout complete" onClose={() => close('workoutSummary')} footer={<Button block variant="primary" onClick={() => close('workoutSummary')}>Nice</Button>}>
      <Card dark screws elevated>
        <div className="col center" style={{ alignItems: 'center', gap: 6 }}>
          <Trophy size={36} color="#ff4757" />
          <div className="num" style={{ fontSize: '2.2rem', fontWeight: 800 }}>{Math.round(convert(session.totalVolume, session.unit, unit)).toLocaleString()} {unit}</div>
          <div className="label">Total volume lifted</div>
        </div>
      </Card>
      <div className="grid3">
        <Card style={{ padding: 12, textAlign: 'center' }}><div className="label">Time</div><strong className="num">{fmtClock(session.duration)}</strong></Card>
        <Card style={{ padding: 12, textAlign: 'center' }}><div className="label">Sets</div><strong className="num">{sets.length}</strong></Card>
        <Card style={{ padding: 12, textAlign: 'center' }}><div className="label">PRs</div><strong className="num">{prs?.length ?? 0}</strong></Card>
      </div>
      {prs && prs.length > 0 && (
        <Card recessed className="col"><span className="label">Personal records</span>{prs.map((p) => <div key={p} className="row"><Trophy size={16} className="accent" />{p}</div>)}</Card>
      )}
    </Sheet>
  );
}
