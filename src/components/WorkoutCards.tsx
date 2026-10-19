import { Dumbbell, FastForward, Play, RotateCcw, Trophy } from 'lucide-react';
import type { WorkoutSession } from '../db/types';
import { fmtDuration, todayStr } from '../lib/dates';
import { convert, type Unit } from '../lib/units';
import { sum } from '../lib/util';
import { toggleSkip, type Planned } from '../repo/workoutRepository';
import { useUnit } from '../store/useAppStore';
import { useUIStore } from '../store/useUIStore';
import { useWorkoutStore } from '../store/useWorkoutStore';
import type { WorkoutState } from '../lib/timeline';
import { Button, Card, Housing, Led, Tag } from './ui';

export const volumeLabel = (sessions: WorkoutSession[], unit: Unit) =>
  `${Math.round(sum(sessions.map((s) => convert(s.totalVolume, s.unit, unit)))).toLocaleString()} ${unit}`;

/** Workout entry in the unified timeline / calendar agenda. */
export function WorkoutTimelineCard({ state, planned, sessions, date }: { state: WorkoutState; planned?: Planned; sessions: WorkoutSession[]; date: string }) {
  const unit = useUnit();
  const open = useUIStore((s) => s.open);
  const start = useWorkoutStore((s) => s.startWorkout);
  const isToday = date === todayStr();
  const routine = planned?.routine?.routine;

  if (state === 'active') {
    return (
      <Card screws elevated onClick={() => open('activeWorkout')}>
        <div className="row">
          <Led color="red" pulse />
          <div className="grow"><div className="label">Workout in progress</div><strong>Tap to resume your session</strong></div>
          <Play size={22} className="accent" />
        </div>
      </Card>
    );
  }
  if (state === 'done') {
    const s = sessions[0];
    return (
      <Card screws onClick={() => open('sessionDetail', { id: s.id })}>
        <div className="row">
          <Housing><Trophy size={20} /></Housing>
          <div className="grow">
            <strong>{s.dayName ?? s.routineName ?? 'Workout'}</strong>
            <div className="small muted num">{volumeLabel(sessions, unit)} lifted · {fmtDuration(sum(sessions.map((x) => x.duration)) / 60)}</div>
          </div>
          <Tag tone="ok">Done</Tag>
        </div>
      </Card>
    );
  }
  if (state === 'skipped' && routine) {
    return (
      <Card screws>
        <div className="row">
          <Housing><FastForward size={20} /></Housing>
          <div className="grow"><strong>Workout skipped</strong><div className="small muted">The session rolls forward to your next training day.</div></div>
          <Button sm onClick={() => toggleSkip(routine.id, date)}><RotateCcw size={14} /> Undo</Button>
        </div>
      </Card>
    );
  }
  if (state === 'planned' && planned?.day && routine) {
    return (
      <Card screws>
        <div className="row">
          <Housing><Dumbbell size={20} /></Housing>
          <div className="grow">
            <div className="label">{routine.name}{planned.sequence ? ` · Session ${planned.sequence}` : ''}</div>
            <strong>{planned.day.day.dayName}</strong>
            <div className="small muted">{planned.day.exercises.length} exercises</div>
          </div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          {isToday && <Button variant="primary" sm onClick={() => { start({ routineId: routine.id, day: planned.day }); open('activeWorkout'); }}><Play size={14} /> Start</Button>}
          <Button sm onClick={() => toggleSkip(routine.id, date)}><FastForward size={14} /> Skip day</Button>
        </div>
      </Card>
    );
  }
  return null;
}
