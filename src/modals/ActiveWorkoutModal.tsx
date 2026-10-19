import { Calculator, ChevronUp, Link2, Minus, Plus, Timer, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Card, Confirm, Field, NumInput, Sheet, TextArea, Toggle } from '../components/ui';
import { fmtClock } from '../lib/dates';
import { incrementFor } from '../lib/units';
import { cx } from '../lib/util';
import { useUIStore } from '../store/useUIStore';
import { SET_TYPE_LABEL, useWorkoutStore } from '../store/useWorkoutStore';
import type { DraftSet } from '../repo/workoutRepository';

const SET_TYPE_NAME: Record<string, string> = { normal: 'Normal', warmup: 'Warm-up', dropset: 'Drop set', failure: 'To failure', amrap: 'AMRAP', rest_pause: 'Rest-pause', superset: 'Superset' };
const WT_NAME: Record<string, string> = { standard: 'Standard', bodyweight: 'Bodyweight (+)', assisted: 'Assisted (−)', cardio: 'Cardio' };

function useNow(ms = 250) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

function SetRow({ exIdx, setIdx, s, unit }: { exIdx: number; setIdx: number; s: DraftSet; unit: 'kg' | 'lb' }) {
  const w = useWorkoutStore.getState();
  const [more, setMore] = useState(s.rpe != null || s.rir != null || s.weightType !== 'standard');
  const cardio = s.weightType === 'cardio';
  const distUnit = unit === 'kg' ? 'km' : 'mi';
  return (
    <div className="col" style={{ gap: 6, opacity: s.completed ? 0.8 : 1 }}>
      <div className="row" style={{ gap: 6 }}>
        <button type="button" className={cx('setbadge', s.setType)} style={{ width: 46, flex: 'none' }} onClick={() => w.cycleSetType(exIdx, setIdx)} aria-label={`Set ${setIdx + 1}, ${SET_TYPE_NAME[s.setType]}. Tap to change type`} title={SET_TYPE_NAME[s.setType]}>
          {s.setType === 'normal' ? setIdx + 1 : SET_TYPE_LABEL[s.setType]}
        </button>
        {cardio ? (
          <>
            <div className="grow"><NumInput value={Math.round((s.timeSeconds ?? 0) / 60 * 10) / 10} onChange={(n) => w.updateSet(exIdx, setIdx, { timeSeconds: Math.round(n * 60) })} label="Minutes" placeholder="min" /></div>
            <div className="grow"><NumInput value={s.distance ?? 0} onChange={(n) => w.updateSet(exIdx, setIdx, { distance: n })} label="Distance" placeholder={distUnit} /></div>
          </>
        ) : (
          <>
            <div className="grow"><NumInput value={s.weight} onChange={(n) => w.updateSet(exIdx, setIdx, { weight: n })} label={`Weight in ${unit}`} placeholder={unit} /></div>
            <div className="grow"><NumInput value={s.reps} onChange={(n) => w.updateSet(exIdx, setIdx, { reps: Math.round(n) })} label="Reps" placeholder="reps" /></div>
          </>
        )}
        <button type="button" className={cx('check', s.completed && 'on')} style={{ width: 44, height: 44 }} aria-pressed={s.completed} aria-label={s.completed ? 'Undo set' : 'Complete set'} onClick={() => w.completeSet(exIdx, setIdx)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </button>
      </div>
      <div className="row wrap" style={{ gap: 6, paddingLeft: 52 }}>
        {!cardio && (
          <>
            <Button sm onClick={() => w.bumpWeight(exIdx, setIdx)} aria-label={`Add ${incrementFor(unit)} ${unit}`}>+{incrementFor(unit)}{unit}</Button>
            <Button sm variant="ghost" onClick={() => w.bumpWeight(exIdx, setIdx, -1)} aria-label={`Subtract ${incrementFor(unit)} ${unit}`}><Minus size={14} /></Button>
          </>
        )}
        <Button sm variant="ghost" aria-expanded={more} onClick={() => setMore((m) => !m)}>{more ? 'Less' : `${WT_NAME[s.weightType].split(' ')[0]}${s.rpe ? ` · RPE ${s.rpe}` : ''} ▾`}</Button>
      </div>
      {more && (
        <div className="row wrap" style={{ gap: 6, paddingLeft: 52 }}>
          <Button sm variant="ghost" onClick={() => w.cycleWeightType(exIdx, setIdx)} aria-label="Change weight type">{WT_NAME[s.weightType]}</Button>
          <select className="select compact" style={{ width: 82, minHeight: 36, textAlign: 'left', fontSize: '0.75rem' }} aria-label="RPE" value={s.rpe ?? ''} onChange={(e) => w.updateSet(exIdx, setIdx, { rpe: e.target.value ? Number(e.target.value) : null })}>
            <option value="">RPE</option>{[6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((n) => <option key={n} value={n}>RPE {n}</option>)}
          </select>
          <select className="select compact" style={{ width: 74, minHeight: 36, textAlign: 'left', fontSize: '0.75rem' }} aria-label="RIR" value={s.rir ?? ''} onChange={(e) => w.updateSet(exIdx, setIdx, { rir: e.target.value === '' ? null : Number(e.target.value) })}>
            <option value="">RIR</option>{[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>RIR {n}</option>)}
          </select>
          <button type="button" className="iconbtn sm" aria-label="Remove set" onClick={() => w.removeSet(exIdx, setIdx)}><Trash2 size={14} /></button>
        </div>
      )}
    </div>
  );
}

function RestBar() {
  const rest = useWorkoutStore((s) => s.active?.restEndsAt ?? null);
  const total = useWorkoutStore((s) => s.active?.restTotal ?? 0);
  const now = useNow();
  const { adjustRest, skipRest } = useWorkoutStore.getState();
  if (!rest || rest <= now) return null;
  const left = Math.ceil((rest - now) / 1000);
  return (
    <Card dark style={{ padding: 12 }}>
      <div className="row">
        <Timer size={18} />
        <div className="grow"><div className="label">Rest</div><div className="num" style={{ fontSize: '1.6rem', fontWeight: 700 }}>{fmtClock(left)}</div></div>
        <Button sm onClick={() => adjustRest(-15)}>−15s</Button>
        <Button sm onClick={() => adjustRest(30)}>+30s</Button>
        <button type="button" className="iconbtn sm" aria-label="Skip rest" onClick={skipRest}><X size={16} /></button>
      </div>
      <div className="bar" style={{ marginTop: 10 }}><i style={{ width: `${Math.min(100, (left / Math.max(total, left)) * 100)}%` }} /></div>
    </Card>
  );
}

export function ActiveWorkoutModal() {
  const active = useWorkoutStore((s) => s.active);
  const exercises = useWorkoutStore((s) => s.exercises);
  const close = useUIStore((s) => s.close);
  const open = useUIStore((s) => s.open);
  const toast = useUIStore((s) => s.toast);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const now = useNow(1000);
  const w = useWorkoutStore.getState();

  useEffect(() => { if (!active) close('activeWorkout'); }, [active, close]);
  if (!active) return null;
  const elapsed = Math.floor((now - active.startedAt) / 1000);
  const done = active.exercises.reduce((n, e) => n + e.sets.filter((s) => s.completed).length, 0);
  const total = active.exercises.reduce((n, e) => n + e.sets.length, 0);

  const finish = () => {
    const sum = useWorkoutStore.getState().finish();
    if (!sum) { toast('Complete at least one set first', { tone: 'warn' }); return; }
    close('activeWorkout');
    open('workoutSummary', { id: sum.session.id, prs: sum.prs.map((p) => `${p.name} (${p.kind})`) });
  };

  return (
    <Sheet full title={<span className="col" style={{ gap: 0 }}><span>{active.dayName ?? active.routineName ?? 'Workout'}</span><span className="num muted small" style={{ fontWeight: 500 }}>{fmtClock(elapsed)} · {done}/{total} sets</span></span>}
      onClose={() => close('activeWorkout')} z={65}
      headerRight={<button type="button" className="iconbtn sm" aria-label="Minimise workout" onClick={() => close('activeWorkout')}><ChevronUp size={18} style={{ transform: 'rotate(180deg)' }} /></button>}
      footer={<><Button aria-label="Discard workout" onClick={() => setConfirmDiscard(true)}><Trash2 size={16} /></Button><Button block variant="primary" onClick={finish}>Finish workout</Button></>}>
      <RestBar />
      {active.exercises.length === 0 && <Card recessed><p className="muted small" style={{ textAlign: 'center' }}>Empty session — add your first exercise.</p></Card>}
      {active.exercises.map((ex, exIdx) => {
        const info = exercises.find((e) => e.id === ex.exerciseId);
        return (
          <Card key={exIdx} screws>
            <div className="col" style={{ gap: 12 }}>
              <div className="row" style={{ paddingRight: 36 }}>
                <div className="grow">
                  <strong>{info?.name ?? 'Exercise'}</strong>
                  <div className="row tiny muted" style={{ gap: 6 }}>
                    <span>{info?.muscle}</span><span>· rest {ex.rest}s</span>
                    {ex.supersetGroup && <span className="tag row" style={{ gap: 3 }}><Link2 size={10} /> {ex.supersetGroup}</span>}
                  </div>
                </div>
                <button type="button" className="iconbtn sm" aria-label="Remove exercise" onClick={() => w.removeExercise(exIdx)}><X size={16} /></button>
              </div>
              {ex.sets.map((s, i) => <SetRow key={s.id} exIdx={exIdx} setIdx={i} s={s} unit={active.unit} />)}
              <Button sm block onClick={() => w.addSet(exIdx)}><Plus size={14} /> Add set</Button>
            </div>
          </Card>
        );
      })}
      <div className="row">
        <Button block onClick={() => open('exercisePicker', { onPick: (id: string) => useWorkoutStore.getState().addExercise(id) })}><Plus size={16} /> Add exercise</Button>
        <Button block onClick={() => open('plate')}><Calculator size={16} /> Plates</Button>
      </div>

      <Card recessed className="col">
        <span className="label">Session wrap-up</span>
        <Field label="Fatigue rating (1 fresh – 5 exhausted)">
          <div className="grid3" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
            {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" className="pill" aria-pressed={active.fatigueRating === n} style={{ justifyContent: 'center', padding: 0, height: 46 }} onClick={() => w.patchActive({ fatigueRating: n })}>{n}</button>)}
          </div>
        </Field>
        <div className="row between"><span>Deload session</span><Toggle label="Deload session" checked={active.isDeload} onChange={(v) => w.patchActive({ isDeload: v })} /></div>
        <Field label="Notes"><TextArea style={{ minHeight: 70 }} value={active.notes} onChange={(e) => w.patchActive({ notes: e.target.value })} placeholder="How did it feel?" /></Field>
      </Card>
      {confirmDiscard && <Confirm title="Discard workout?" text="Everything logged in this session will be lost." confirmLabel="Discard" onConfirm={() => { w.discard(); }} onClose={() => setConfirmDiscard(false)} />}
    </Sheet>
  );
}
