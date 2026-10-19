import { BrainCircuit, Link, Pin, Plus, Search, Settings, Smartphone, Sun, Timer, Zap, Dumbbell } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Markdown } from '../components/Markdown';
import { PomodoroTimer } from '../components/PomodoroTimer';
import { Button, Card, Empty, Housing, Led, Pills, Segmented, TextInput } from '../components/ui';
import { generateInsights } from '../lib/insightsEngine';
import { fmtShort, isoToLocalDate } from '../lib/dates';
import { isScheduledOn } from '../repo/habitRepository';
import { useInstall } from '../lib/useInstall';
import { togglePin } from '../repo/noteRepository';
import { useAppStore } from '../store/useAppStore';
import { useUIStore } from '../store/useUIStore';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { NOTE_FOLDERS } from '../modals/NoteEditor';
import type { NoteFolder } from '../db/types';

const INSIGHT_ICONS = { Dumbbell, Link, Sun, Zap, Timer } as const;
type Section = 'focus' | 'insights' | 'notes';

export function MoreScreen() {
  const open = useUIStore((s) => s.open);
  const [section, setSection] = useState<Section>('focus');
  const [q, setQ] = useState('');
  const [folder, setFolder] = useState<'All' | NoteFolder>('All');
  const tasks = useAppStore((s) => s.tasks);
  const habits = useAppStore((s) => s.habits);
  const habitLogs = useAppStore((s) => s.habitLogs);
  const pomodoros = useAppStore((s) => s.pomodoros);
  const notes = useAppStore((s) => s.notes);
  const sessions = useWorkoutStore((s) => s.sessions);
  const install = useInstall();

  const insights = useMemo(
    () => generateInsights({ tasks, sessions, habits, habitLogs, pomodoros, isScheduled: isScheduledOn }),
    [tasks, sessions, habits, habitLogs, pomodoros],
  );
  const shown = notes
    .filter((n) => folder === 'All' || n.folder === folder)
    .filter((n) => !q || (n.title + ' ' + n.content).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.pinned - a.pinned || b.updatedAt.localeCompare(a.updatedAt));

  return (
    <main className="screen">
      <header className="screen-head">
        <div><div className="row"><Led /><span className="label">Control panel</span></div><h1>More</h1></div>
        <div className="row">
          <button type="button" className="iconbtn" aria-label="Widget preview" onClick={() => open('widget')}><Smartphone size={20} /></button>
          <button type="button" className="iconbtn" aria-label="Settings" onClick={() => open('settings')}><Settings size={20} /></button>
        </div>
      </header>

      {install.canInstall && !install.installed && (
        <Card screws>
          <div className="row"><Housing><Smartphone size={20} /></Housing><div className="grow"><strong>Install TaskFlow</strong><div className="small muted">Run full-screen and fully offline from your home screen.</div></div><Button variant="primary" sm onClick={install.install}>Install</Button></div>
        </Card>
      )}

      <Segmented<Section> value={section} onChange={setSection} options={[{ value: 'focus', label: 'Focus' }, { value: 'insights', label: 'Insights' }, { value: 'notes', label: 'Notes' }]} />

      {section === 'focus' && <PomodoroTimer />}

      {section === 'insights' && (
        <>
          <Card dark screws>
            <div className="row"><BrainCircuit size={26} color="#ff4757" /><div className="grow"><strong>Cross-domain synergy</strong><div className="small" style={{ color: '#a8b2d1' }}>Correlations between your workouts, habits and task output over the last 90 days.</div></div></div>
          </Card>
          {insights.length === 0 && <Empty icon={<BrainCircuit size={22} />} title="Not enough data yet" text="Insights appear after a couple of weeks of activity. Load demo data from Settings to preview them." action={<Button onClick={() => open('settings')}>Open settings</Button>} />}
          {insights.map((i) => {
            const Icon = INSIGHT_ICONS[i.icon as keyof typeof INSIGHT_ICONS] ?? Zap;
            return (
              <Card key={i.id} screws vents>
                <div className="row" style={{ alignItems: 'flex-start', gap: 14 }}>
                  <Housing><Icon size={20} /></Housing>
                  <div className="grow col" style={{ gap: 4 }}>
                    <span className="label">{i.title}</span>
                    <span className="num" style={{ fontSize: '1.7rem', fontWeight: 800, letterSpacing: '-0.03em' }}>{i.metric}</span>
                    <p className="small">{i.body}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </>
      )}

      {section === 'notes' && (
        <>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: 16, top: 19, color: 'var(--muted)' }} />
            <TextInput placeholder="Search titles and content" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 44 }} aria-label="Search notes" />
          </div>
          <Pills options={['All', ...NOTE_FOLDERS] as const} value={folder} onChange={(f) => setFolder(f as typeof folder)} />
          <Button variant="primary" onClick={() => open('note')}><Plus size={16} /> New note</Button>
          {shown.length === 0 && <Empty title={notes.length ? 'No matching notes' : 'No notes yet'} text="Capture ideas, journal entries and checklists in markdown." />}
          {shown.map((n) => (
            <Card key={n.id} screws lift onClick={() => open('note', { id: n.id })}>
              <div className="col" style={{ gap: 8 }}>
                <div className="row">
                  <div className="grow"><strong>{n.title}</strong><div className="tiny muted num">{n.folder} · {fmtShort(isoToLocalDate(n.updatedAt))}</div></div>
                  <button type="button" className={`iconbtn sm${n.pinned ? ' on' : ''}`} aria-label={n.pinned ? 'Unpin note' : 'Pin note'} onClick={(e) => { e.stopPropagation(); togglePin(n.id); }}><Pin size={16} /></button>
                </div>
                <div style={{ maxHeight: 96, overflow: 'hidden', maskImage: 'linear-gradient(#000 60%, transparent)' }}><Markdown source={n.content.slice(0, 400)} /></div>
              </div>
            </Card>
          ))}
        </>
      )}
    </main>
  );
}
