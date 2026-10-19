import { Plus } from 'lucide-react';
import { useState } from 'react';
import { HabitRow } from '../components/HabitRow';
import { MonthCalendar } from '../components/MonthCalendar';
import { SwipeableTaskItem } from '../components/SwipeableTaskItem';
import { WorkoutTimelineCard } from '../components/WorkoutCards';
import { Button, Card, Empty, Pills } from '../components/ui';
import { agendaHeader } from '../lib/dates';
import { isScheduledOn } from '../repo/habitRepository';
import { taskStart } from '../repo/taskRepository';
import { useAppStore } from '../store/useAppStore';
import { useUIStore } from '../store/useUIStore';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { usePlanned } from './Today';

const FILTERS = ['All', 'Tasks', 'Workouts', 'Habits'] as const;
type Filter = (typeof FILTERS)[number];

export function CalendarScreen() {
  const date = useUIStore((s) => s.selectedDate);
  const setDate = useUIStore((s) => s.setDate);
  const open = useUIStore((s) => s.open);
  const tasks = useAppStore((s) => s.tasks);
  const habits = useAppStore((s) => s.habits);
  const sessions = useWorkoutStore((s) => s.sessions);
  const planned = usePlanned(date);
  const [filter, setFilter] = useState<Filter>('All');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const dayTasks = tasks.filter((t) => t.dueDate === date).sort((a, b) => (taskStart(a) ?? '99:99').localeCompare(taskStart(b) ?? '99:99'));
  const dayHabits = habits.filter((h) => !h.archived && isScheduledOn(h, date));
  const daySessions = sessions.filter((s) => s.date === date);
  const showT = filter === 'All' || filter === 'Tasks';
  const showW = filter === 'All' || filter === 'Workouts';
  const showH = filter === 'All' || filter === 'Habits';
  const wState = daySessions.length ? 'done' : planned.status === 'planned' ? 'planned' : planned.status === 'skipped' ? 'skipped' : 'rest';
  const toggleSel = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const nothing = (!showT || !dayTasks.length) && (!showW || wState === 'rest') && (!showH || !dayHabits.length);

  return (
    <main className="screen">
      <header className="screen-head"><h1>Calendar</h1></header>
      <Card screws vents><MonthCalendar selected={date} onSelect={setDate} /></Card>

      <section className="col" aria-label="Day agenda">
        <div className="row between">
          <h2 className="h2">{agendaHeader(date)}</h2>
        </div>
        <Pills options={FILTERS} value={filter} onChange={setFilter} />
        {showW && wState !== 'rest' && <WorkoutTimelineCard state={wState} planned={planned} sessions={daySessions} date={date} />}
        {showT && dayTasks.map((t) => (
          <SwipeableTaskItem key={t.id} task={t} selectMode={selected.size > 0} selected={selected.has(t.id)} onLongPress={toggleSel} onToggleSelect={toggleSel} />
        ))}
        {showH && dayHabits.map((h) => <HabitRow key={h.id} habit={h} date={date} compact />)}
        {nothing && <Empty title="Nothing scheduled" text="Use the buttons below to plan this day." />}
        <div className="row">
          <Button block onClick={() => open('task', { date })}><Plus size={16} /> Add task</Button>
          <Button block onClick={() => open('habit')}><Plus size={16} /> Add habit</Button>
        </div>
      </section>
    </main>
  );
}
