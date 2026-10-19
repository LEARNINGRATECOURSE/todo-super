import { CheckCheck, CircleCheck, Dumbbell, Hourglass, Plus, Timer, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { DateStrip } from '../components/DateStrip';
import { HabitRow } from '../components/HabitRow';
import { SwipeableTaskItem } from '../components/SwipeableTaskItem';
import { EisenhowerMatrix, KanbanBoard } from '../components/TaskViews';
import { WorkoutTimelineCard, volumeLabel } from '../components/WorkoutCards';
import { Button, Card, Empty, Led, Segmented } from '../components/ui';
import { fmtDuration, fmtTime12, minToTime, relativeLabel, agendaHeader } from '../lib/dates';
import { buildTimeline, freeLabel } from '../lib/timeline';
import { sum } from '../lib/util';
import { dayRate } from '../repo/habitRepository';
import { activeRoutine, plannedFor } from '../repo/workoutRepository';
import { useAppStore, useSetting, useUnit } from '../store/useAppStore';
import { useUIStore } from '../store/useUIStore';
import { useWorkoutStore } from '../store/useWorkoutStore';

type View = 'timeline' | 'board' | 'matrix';

/** Shared by Today and Calendar: planned/active/done workout for a date. */
export function usePlanned(date: string) {
  const routines = useWorkoutStore((s) => s.routines);
  const days = useWorkoutStore((s) => s.routineDays);
  const exercises = useWorkoutStore((s) => s.routineExercises);
  const activeId = useSetting('activeRoutineId');
  return useMemo(() => plannedFor(activeRoutine()?.id, date), [routines, days, exercises, activeId, date]);
}

export function TodayScreen() {
  const date = useUIStore((s) => s.selectedDate);
  const setDate = useUIStore((s) => s.setDate);
  const open = useUIStore((s) => s.open);
  const anchor = useUIStore((s) => s.anchor);
  const setAnchor = useUIStore((s) => s.setAnchor);
  const [view, setView] = useState<View>('timeline');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [, tick] = useState(0);
  const tasks = useAppStore((s) => s.tasks);
  const habits = useAppStore((s) => s.habits);
  const habitLogs = useAppStore((s) => s.habitLogs);
  const sessions = useWorkoutStore((s) => s.sessions);
  const active = useWorkoutStore((s) => s.active);
  const workoutTime = useSetting('workoutTime', '18:00');
  const unit = useUnit();
  const planned = usePlanned(date);
  const { completeTasks, removeTasks } = useAppStore.getState();

  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t); }, []);
  useEffect(() => setSelected(new Set()), [date, view]);

  const model = useMemo(
    () => buildTimeline({ date, tasks, habits, sessions, planned, workoutActive: !!active, workoutTime }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [date, tasks, habits, sessions, planned, active, workoutTime, Math.floor(Date.now() / 60000)],
  );

  const dayTasks = tasks.filter((t) => t.dueDate === date);
  const doneCount = dayTasks.filter((t) => t.completed).length;
  const rate = useMemo(() => dayRate(date), [date, habits, habitLogs]);
  const habitPct = rate.total ? Math.round((rate.done / rate.total) * 100) : 0;
  const daySessions = sessions.filter((s) => s.date === date);
  const focusMin = sum(dayTasks.map((t) => t.estimatedMinutes)) + sum(daySessions.map((s) => s.duration / 60));
  const wLabel = { active: 'Active', done: 'Done', planned: 'Planned', skipped: 'Skipped', rest: 'Rest' }[model.workoutState];
  const wSub = model.workoutState === 'done' ? volumeLabel(daySessions, unit) : model.workoutState === 'planned' ? planned.day?.day.dayName ?? 'Routine day' : model.workoutState === 'active' ? 'In progress' : model.workoutState === 'skipped' ? 'Rolled forward' : 'Recovery day';

  const selectMode = selected.size > 0;
  const toggleSel = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const empty = model.allDay.length === 0 && model.timed.filter((t) => t.kind !== 'now').length === 0;

  const renderItem = (it: (typeof model.timed)[number]) => {
    switch (it.kind) {
      case 'free':
        return <div key={it.key} className="free"><Hourglass size={14} /> {freeLabel(it.minutes)}</div>;
      case 'now':
        return <div key={it.key} className="now" aria-label={`Current time ${it.label}`}><span className="badge">{fmtTime12(it.label)}</span><span className="line" /></div>;
      case 'task':
        return (
          <div key={it.key} className="tl-item">
            <div className="tl-time">{it.start != null ? minToTime(it.start) : ''}</div>
            <div className="tl-body"><SwipeableTaskItem task={it.task} overdue={it.overdue} selectMode={selectMode} selected={selected.has(it.task.id)} onLongPress={toggleSel} onToggleSelect={toggleSel} /></div>
          </div>
        );
      case 'habit':
        return (
          <div key={it.key} className="tl-item">
            <div className="tl-time">{it.start != null ? minToTime(it.start) : ''}</div>
            <div className="tl-body"><HabitRow habit={it.habit} date={date} slot={it.slot} compact /></div>
          </div>
        );
      case 'workout':
        return (
          <div key={it.key} className="tl-item">
            <div className="tl-time">{minToTime(it.start)}</div>
            <div className="tl-body"><WorkoutTimelineCard state={it.state} planned={it.planned} sessions={it.sessions} date={date} /></div>
          </div>
        );
    }
  };

  return (
    <main className="screen" style={selectMode ? { paddingBottom: 'calc(var(--tabbar-h) + var(--safe-bottom) + 190px)' } : undefined}>
      <header className="screen-head">
        <div>
          <div className="row"><Led pulse /><span className="label">System operational</span></div>
          <h1>{relativeLabel(date) === 'Today' ? 'Today' : relativeLabel(date)}</h1>
          <span className="small muted num">{agendaHeader(date)}</span>
        </div>
        <Button variant="primary" onClick={() => open('task', { date })}><Plus size={16} /> Task</Button>
      </header>

      <section className="metrics" aria-label="Day summary">
        <Card className="metric" screws={false}>
          <span className="label row" style={{ gap: 6 }}><CircleCheck size={13} /> Tasks done</span>
          <span className="v">{doneCount}<span className="muted">/{dayTasks.length}</span></span>
          <span className="s">{dayTasks.length ? `${dayTasks.length - doneCount} remaining` : 'Nothing planned'}</span>
        </Card>
        <Card className="metric">
          <span className="label row" style={{ gap: 6 }}><CheckCheck size={13} /> Habits rate</span>
          <span className="v">{habitPct}%</span>
          <span className="s">{rate.done}/{rate.total} targets</span>
        </Card>
        <Card className="metric" onClick={() => model.workoutState === 'active' && open('activeWorkout')}>
          <span className="label row" style={{ gap: 6 }}><Dumbbell size={13} /> Workout</span>
          <span className="v" style={{ color: model.workoutState === 'done' ? 'var(--ok)' : model.workoutState === 'active' ? 'var(--accent)' : undefined }}>{wLabel}</span>
          <span className="s truncate">{wSub}</span>
        </Card>
        <Card className="metric">
          <span className="label row" style={{ gap: 6 }}><Timer size={13} /> Focus time</span>
          <span className="v">{fmtDuration(focusMin)}</span>
          <span className="s">Planned + lifted</span>
        </Card>
      </section>

      {anchor && (
        <div className="banner" role="status">
          <Led color="red" pulse />
          <strong className="grow small">{anchor.text}</strong>
          <Button sm variant="primary" onClick={() => { open('habit', { id: anchor.habitId }); setAnchor(null); }}>View</Button>
          <button type="button" aria-label="Dismiss" className="iconbtn sm" onClick={() => setAnchor(null)}><X size={16} /></button>
        </div>
      )}

      <DateStrip value={date} onChange={setDate} />

      <Segmented<View> value={view} onChange={setView} options={[{ value: 'timeline', label: 'Timeline' }, { value: 'board', label: 'Board' }, { value: 'matrix', label: 'Matrix' }]} />

      {view === 'board' && <KanbanBoard date={date} />}
      {view === 'matrix' && <EisenhowerMatrix date={date} />}
      {view === 'timeline' && (
        <div className="timeline">
          {model.allDay.length > 0 && (
            <>
              <div className="section-title"><span className="label">Anytime</span></div>
              {model.allDay.map((it) =>
                it.kind === 'task' ? (
                  <SwipeableTaskItem key={it.key} task={it.task} overdue={it.overdue} selectMode={selectMode} selected={selected.has(it.task.id)} onLongPress={toggleSel} onToggleSelect={toggleSel} />
                ) : it.kind === 'habit' ? (
                  <HabitRow key={it.key} habit={it.habit} date={date} compact />
                ) : null,
              )}
              <div className="section-title"><span className="label">Schedule</span></div>
            </>
          )}
          {model.timed.map(renderItem)}
          {empty && (
            <Empty icon={<CircleCheck size={22} />} title="A clear day" text="Add a task, or load demo data from More → Settings to explore the unified timeline." action={<Button variant="primary" onClick={() => open('task', { date })}><Plus size={16} /> Add task</Button>} />
          )}
        </div>
      )}

      {selectMode && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 'calc(var(--tabbar-h) + var(--safe-bottom) + 22px)', zIndex: 35, display: 'flex', justifyContent: 'center', padding: '0 16px' }}>
          <Card elevated dark style={{ padding: 12, width: '100%', maxWidth: 560 }}>
            <div className="col" style={{ gap: 10 }}>
              <div className="row between">
                <strong className="num">{selected.size} selected</strong>
                <button type="button" className="iconbtn sm" aria-label="Cancel selection" onClick={() => setSelected(new Set())}><X size={16} /></button>
              </div>
              <div className="row">
                <Button block sm variant="primary" onClick={() => { completeTasks([...selected]); setSelected(new Set()); }}><CheckCheck size={14} /> Complete all</Button>
                <Button block sm onClick={() => { removeTasks([...selected]); setSelected(new Set()); }}><Trash2 size={14} /> Delete all</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
