import { Pause, Play, RotateCcw, SkipForward, Volume2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { setAmbientVolume, unlockAudio, type Soundscape } from '../lib/audio';
import { fmtClock } from '../lib/dates';
import { MODES, syncAmbient, usePomodoroStore, type PomodoroMode } from '../store/usePomodoroStore';
import { useAppStore } from '../store/useAppStore';
import { requestNotificationPermission, notificationPermission } from '../lib/notifications';
import { Button, Card, Led, Pills, Ring, Segmented, Select } from './ui';

const SOUNDS: { id: Soundscape; label: string }[] = [{ id: 'rain', label: 'Rain' }, { id: 'white', label: 'White Noise' }, { id: 'cafe', label: 'Cafe' }, { id: 'forest', label: 'Forest' }, { id: 'mute', label: 'Mute' }];

export function PomodoroTimer() {
  const p = usePomodoroStore();
  const tasks = useAppStore((s) => s.tasks).filter((t) => !t.completed);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);
  const left = p.running && p.endsAt ? Math.max(0, Math.ceil((p.endsAt - now) / 1000)) : p.remaining;
  const total = (p.phase === 'work' ? MODES[p.mode].work : MODES[p.mode].brk) * 60;

  const toggle = () => {
    unlockAudio();
    if (p.running) p.pause(); else {
      p.start();
      if (notificationPermission() === 'default') void requestNotificationPermission();
    }
    queueMicrotask(syncAmbient);
  };

  return (
    <Card dark screws elevated>
      <div className="col" style={{ gap: 16 }}>
        <div className="row between">
          <div className="row"><Led color={p.running ? 'red' : 'off'} pulse={p.running} /><span className="label">{p.phase === 'work' ? 'Focus' : 'Break'} · {MODES[p.mode].label}</span></div>
          <span className="label">{p.mode}</span>
        </div>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Ring value={total ? 1 - left / total : 0} size={196} stroke={12} color={p.phase === 'work' ? '#ff4757' : '#27d17f'} track="#454d50">
            <div className="screen-inset" style={{ padding: '10px 16px', borderRadius: 12 }}>
              <span className="num" style={{ fontSize: '2.4rem', fontWeight: 700, position: 'relative', zIndex: 1 }} aria-live="off">{fmtClock(left)}</span>
            </div>
          </Ring>
        </div>
        <div className="row" style={{ justifyContent: 'center', gap: 14 }}>
          <button type="button" className="iconbtn" aria-label="Reset" onClick={() => { p.reset(); queueMicrotask(syncAmbient); }}><RotateCcw size={20} /></button>
          <Button variant="primary" onClick={toggle} style={{ minWidth: 150, minHeight: 56 }}>{p.running ? <><Pause size={18} /> Pause</> : <><Play size={18} /> Start</>}</Button>
          <button type="button" className="iconbtn" aria-label="Skip phase" onClick={() => { p.skip(); queueMicrotask(syncAmbient); }}><SkipForward size={20} /></button>
        </div>
        <Segmented<PomodoroMode> value={p.mode} onChange={(m) => { p.setMode(m); queueMicrotask(syncAmbient); }} options={(Object.keys(MODES) as PomodoroMode[]).map((m) => ({ value: m, label: m }))} />
        <label className="field">
          <span className="label">Linked task</span>
          <Select style={{ background: '#e0e5ec' }} value={p.taskId ?? ''} onChange={(e) => { const t = tasks.find((x) => x.id === e.target.value); p.link(t?.id ?? null, t?.title ?? null); }}>
            <option value="">No task</option>
            {p.taskId && !tasks.slice(0, 60).some((t) => t.id === p.taskId) && <option value={p.taskId}>{p.taskTitle ?? 'Linked task'}</option>}
            {tasks.slice(0, 60).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </Select>
        </label>
        <div className="col" style={{ gap: 8 }}>
          <span className="label row" style={{ gap: 6 }}><Volume2 size={13} /> Ambient soundscape</span>
          <div style={{ background: 'var(--chassis)', borderRadius: 16, color: 'var(--text)' }}>
            <Pills options={SOUNDS.map((s) => s.label) as readonly string[]} value={SOUNDS.find((s) => s.id === p.sound)!.label} onChange={(l) => { p.setSound(SOUNDS.find((s) => s.label === l)!.id); unlockAudio(); queueMicrotask(syncAmbient); }} />
          </div>
          <input type="range" min={0} max={1} step={0.05} value={p.volume} aria-label="Ambient volume" onChange={(e) => { p.setVolume(Number(e.target.value)); setAmbientVolume(Number(e.target.value)); }} />
        </div>
      </div>
    </Card>
  );
}
