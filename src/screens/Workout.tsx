import { Activity, AlertTriangle, BookOpen, Calculator, Copy, Dumbbell, FastForward, Pencil, Play, Plus, Ruler, Trash2, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BarChart, LineChart } from '../components/Charts';
import { WorkoutTimelineCard, volumeLabel } from '../components/WorkoutCards';
import { Button, Card, Confirm, Empty, Housing, IconButton, Led, Pills, Segmented, Tag } from '../components/ui';
import { FOLDERS } from '../data/programs';
import { fmtDuration, fmtShort, mondayOf, todayStr, addDays } from '../lib/dates';
import { estimate1RM } from '../lib/oneRepMax';
import { convert, fmtWeight, type Unit } from '../lib/units';
import { parseJSON, sum } from '../lib/util';
import { computeFatigue, deleteRoutine, duplicateRoutine, getRoutineFull, plannedFor, toggleSkip } from '../repo/workoutRepository';
import { setUnit, useSetting, useUnit } from '../store/useAppStore';
import { useUIStore } from '../store/useUIStore';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { setSetting } from '../repo/settings';
import { usePlanned } from './Today';
import { DAY_SHORT } from '../lib/dates';

type Section = 'routines' | 'history' | 'progress';

export function WorkoutScreen() {
  const unit = useUnit();
  const open = useUIStore((s) => s.open);
  const [section, setSection] = useState<Section>('routines');
  const [folder, setFolder] = useState<(typeof FOLDERS)[number]>('All');
  const [confirm, setConfirm] = useState<string | null>(null);
  const routines = useWorkoutStore((s) => s.routines);
  const routineDays = useWorkoutStore((s) => s.routineDays);
  const routineExercises = useWorkoutStore((s) => s.routineExercises);
  const exercises = useWorkoutStore((s) => s.exercises);
  const sessions = useWorkoutStore((s) => s.sessions);
  const sets = useWorkoutStore((s) => s.sets);
  const measurements = useWorkoutStore((s) => s.measurements);
  const active = useWorkoutStore((s) => s.active);
  const activeId = useSetting('activeRoutineId');
  const date = todayStr();
  const planned = usePlanned(date);
  const todaySessions = sessions.filter((s) => s.date === date);
  const fatigue = useMemo(() => computeFatigue(), [sessions]);

  const shown = routines.filter((r) => folder === 'All' || r.folder === folder);
  const wState = active ? 'active' : todaySessions.length ? 'done' : planned.status === 'planned' ? 'planned' : planned.status === 'skipped' ? 'skipped' : 'rest';

  const history = [...sessions].sort((a, b) => (b.date + (b.startedAt ?? '')).localeCompare(a.date + (a.startedAt ?? '')));

  const weekly = useMemo(() => {
    const start = mondayOf(addDays(date, -7 * 7));
    return Array.from({ length: 8 }, (_, i) => {
      const w = addDays(start, i * 7);
      const e = addDays(w, 6);
      const v = sum(sessions.filter((s) => s.date >= w && s.date <= e).map((s) => convert(s.totalVolume, s.unit, unit)));
      return { label: fmtShort(w).replace(/^\w+ /, ''), value: Math.round(v) };
    });
  }, [sessions, unit, date]);

  const lifts = useMemo(() => {
    const unitBySession = new Map(sessions.map((s) => [s.id, s.unit]));
    const best = new Map<string, { e1rm: number; weight: number; reps: number }>();
    for (const st of sets) {
      if (!st.completed || st.setType === 'warmup' || st.weightType !== 'standard' || st.weight <= 0) continue;
      const w = convert(st.weight, unitBySession.get(st.sessionId) ?? 'kg', unit);
      const e = estimate1RM(w, st.reps);
      if (e > (best.get(st.exerciseId)?.e1rm ?? 0)) best.set(st.exerciseId, { e1rm: e, weight: w, reps: st.reps });
    }
    return [...best.entries()].map(([id, b]) => ({ id, name: exercises.find((e) => e.id === id)?.name ?? '?', ...b })).sort((a, b) => b.e1rm - a.e1rm).slice(0, 8);
  }, [sets, sessions, exercises, unit]);

  const bodyWeights = measurements.filter((m) => m.weight != null).sort((a, b) => a.date.localeCompare(b.date)).slice(-20)
    .map((m) => ({ label: m.date, value: Math.round(convert(m.weight!, 'kg', unit) * 10) / 10 }));

  return (
    <main className="screen">
      <header className="screen-head">
        <div><div className="row"><Led color={active ? 'red' : 'on'} pulse={!!active} /><span className="label">Strength hub</span></div><h1>Workout</h1></div>
        <Segmented<Unit> value={unit} onChange={setUnit} options={[{ value: 'kg', label: 'KG' }, { value: 'lb', label: 'LB' }]} />
      </header>

      {wState !== 'rest' ? <WorkoutTimelineCard state={wState} planned={planned} sessions={todaySessions} date={date} /> : (
        <Card screws><div className="row"><Housing><Dumbbell size={20} /></Housing><div className="grow"><strong>{routines.length ? 'Rest day' : 'No routine yet'}</strong><div className="small muted">{routines.length ? 'Recovery is part of the program.' : 'Import a program or build your own.'}</div></div></div></Card>
      )}
      {!active && (
        <Button block onClick={() => { useWorkoutStore.getState().startWorkout(); open('activeWorkout'); }}>
          <Play size={16} /> Start empty workout
        </Button>
      )}

      {fatigue.deload ? (
        <Card screws style={{ boxShadow: 'var(--shadow-card-sm), 0 0 0 2px rgba(255,71,87,.6)' }}>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <Housing><AlertTriangle size={20} /></Housing>
            <div className="grow col" style={{ gap: 6 }}>
              <strong>Deload recommended</strong>
              {fatigue.reasons.map((r) => <span key={r} className="small">{r}</span>)}
              <span className="small muted">Cut intensity 40–50% this week: same exercises, ~half the weight or sets.</span>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="row">
            <Housing><Activity size={20} /></Housing>
            <div className="grow">
              <div className="label">Training load (ACWR)</div>
              <strong className="num">{fatigue.ratio != null ? fatigue.ratio.toFixed(2) : '—'}</strong>
              <span className="small muted"> {fatigue.building ? '· building your 3-week baseline' : fatigue.ratio != null && fatigue.ratio < 0.8 ? '· detraining zone' : '· sweet spot 0.8–1.3'}</span>
            </div>
            <div className="small muted num" style={{ textAlign: 'right' }}>{fatigue.acuteHours.toFixed(1)}h / 7d<br />{fatigue.chronicHours.toFixed(1)}h avg</div>
          </div>
        </Card>
      )}

      <div className="grid2">
        <Button onClick={() => open('plate')}><Calculator size={16} /> Plates</Button>
        <Button onClick={() => open('oneRm')}><Dumbbell size={16} /> 1RM</Button>
        <Button onClick={() => open('body')}><Ruler size={16} /> Body</Button>
        <Button onClick={() => open('achievements')}><Trophy size={16} /> Badges</Button>
      </div>

      <Segmented<Section> value={section} onChange={setSection} options={[{ value: 'routines', label: 'Routines' }, { value: 'history', label: 'History' }, { value: 'progress', label: 'Progress' }]} />

      {section === 'routines' && (
        <>
          <div className="row">
            <Button block variant="primary" onClick={() => open('routine')}><Plus size={16} /> New routine</Button>
            <Button block onClick={() => open('programs')}><BookOpen size={16} /> Programs</Button>
          </div>
          <Pills options={FOLDERS} value={folder} onChange={setFolder} />
          {shown.length === 0 && <Empty icon={<Dumbbell size={22} />} title="No routines here" text="Import one of 6 battle-tested programs or create your own split." action={<Button variant="primary" onClick={() => open('programs')}>Browse programs</Button>} />}
          {shown.map((r) => {
            const days = routineDays.filter((d) => d.routineId === r.id).sort((a, b) => a.order - b.order);
            const exCount = routineExercises.filter((x) => days.some((d) => d.id === x.routineDayId)).length;
            const muscles = new Map<string, number>();
            routineExercises.filter((x) => days.some((d) => d.id === x.routineDayId)).forEach((x) => { const m = exercises.find((e) => e.id === x.exerciseId)?.muscle; if (m) muscles.set(m, (muscles.get(m) ?? 0) + 1); });
            const sched = parseJSON<string[]>(r.scheduleDays, []).map(Number);
            const isActive = activeId ? activeId === r.id : routines[0]?.id === r.id;
            return (
              <Card key={r.id} screws vents lift>
                <div className="col" style={{ gap: 10 }}>
                  <div className="row" style={{ paddingRight: 48 }}>
                    <div className="grow">
                      <div className="row wrap" style={{ gap: 6 }}><Tag>{r.folder}</Tag>{r.isDeload ? <Tag tone="hot">Deload</Tag> : null}{isActive && <Tag tone="ok">Active</Tag>}</div>
                      <strong style={{ fontSize: '1.05rem' }}>{r.name}</strong>
                    </div>
                  </div>
                  {r.description && <p className="small muted">{r.description}</p>}
                  <div className="row wrap small num" style={{ gap: 10 }}>
                    <span>{days.length} days</span><span>{exCount} exercises</span><span>{sched.map((d) => DAY_SHORT[d][0]).join(' ')}</span>
                  </div>
                  <div className="row wrap" style={{ gap: 6 }}>{[...muscles.entries()].sort((a, b) => b[1] - a[1]).map(([m, n]) => <span key={m} className="tag">{m} ×{n}</span>)}</div>
                  <div className="row wrap">
                    {!isActive && <Button sm variant="primary" onClick={() => { setSetting('activeRoutineId', r.id); }}>Set active</Button>}
                    <IconButton sm label="Edit routine" onClick={() => open('routine', { id: r.id })}><Pencil size={16} /></IconButton>
                    <IconButton sm label="Duplicate routine" onClick={() => { duplicateRoutine(r.id); useUIStore.getState().toast('Routine duplicated', { tone: 'success' }); }}><Copy size={16} /></IconButton>
                    <IconButton sm label="Delete routine" onClick={() => setConfirm(r.id)}><Trash2 size={16} /></IconButton>
                    {isActive && planned.routine?.routine.id === r.id && planned.status === 'planned' && (
                      <Button sm onClick={() => toggleSkip(r.id, date)}><FastForward size={14} /> Skip today</Button>
                    )}
                  </div>
                  {isActive && <RollPreview routineId={r.id} />}
                </div>
              </Card>
            );
          })}
        </>
      )}

      {section === 'history' && (
        <>
          {history.length === 0 && <Empty icon={<Activity size={22} />} title="No sessions yet" text="Finished workouts appear here with volume, PRs and fatigue." />}
          {history.map((s) => (
            <Card key={s.id} onClick={() => open('sessionDetail', { id: s.id })} style={{ padding: 14 }}>
              <div className="row">
                <div className="grow">
                  <strong>{s.dayName ?? s.routineName ?? 'Workout'}</strong>
                  <div className="small muted num">{fmtShort(s.date)} · {fmtDuration(s.duration / 60)} · {volumeLabel([s], unit)}</div>
                </div>
                {s.isDeload ? <Tag tone="hot">Deload</Tag> : null}
                <span className="tag num">F{s.fatigueRating}</span>
              </div>
            </Card>
          ))}
        </>
      )}

      {section === 'progress' && (
        <>
          <Card screws>
            <div className="col"><h2 className="h2">Weekly volume ({unit})</h2><BarChart data={weekly} format={(n) => `${n.toLocaleString()} ${unit}`} /></div>
          </Card>
          <Card screws>
            <div className="col"><h2 className="h2">Estimated 1RM leaders</h2>
              {lifts.length === 0 && <span className="small muted">Complete sets to see your strongest lifts.</span>}
              {lifts.map((l) => (
                <div key={l.id} className="row between"><span className="truncate grow">{l.name}</span><span className="num small muted">{fmtWeight(l.weight)}×{l.reps}</span><strong className="num">{Math.round(l.e1rm)} {unit}</strong></div>
              ))}
            </div>
          </Card>
          <Card screws>
            <div className="col"><h2 className="h2">Body weight ({unit})</h2><LineChart data={bodyWeights} unit="" /></div>
          </Card>
        </>
      )}

      {confirm && <Confirm title="Delete routine?" text="Its days and exercises are removed. Logged sessions are kept." onConfirm={() => deleteRoutine(confirm)} onClose={() => setConfirm(null)} />}
    </main>
  );
}

/** Shows the next few training days so the rolling rotation is visible. */
function RollPreview({ routineId }: { routineId: string }) {
  const full = getRoutineFull(routineId);
  const items = useMemo(() => {
    const out: { date: string; name: string }[] = [];
    if (!full) return out;
    for (let i = 0; i < 14 && out.length < 4; i++) {
      const d = addDays(todayStr(), i);
      const p = plannedLocal(routineId, d);
      if (p) out.push({ date: d, name: p });
    }
    return out;
  }, [routineId, full?.routine.skippedDates, full?.routine.version]);
  if (!items.length) return null;
  return (
    <div className="col" style={{ gap: 6 }}>
      <span className="label">Up next</span>
      <div className="row wrap" style={{ gap: 6 }}>{items.map((i) => <span key={i.date} className="tag num">{i.date === todayStr() ? 'Today' : fmtShort(i.date)} · {i.name}</span>)}</div>
    </div>
  );
}
const plannedLocal = (id: string, d: string) => { const p = plannedFor(id, d); return p.status === 'planned' ? p.day?.day.dayName ?? null : null; };
