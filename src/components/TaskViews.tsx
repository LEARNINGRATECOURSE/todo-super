import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Task, TaskStatus } from '../db/types';
import { todayStr } from '../lib/dates';
import { PRIORITY_ORDER, quadrantOf, setStatus, type Quadrant } from '../repo/taskRepository';
import { useAppStore } from '../store/useAppStore';
import { useUIStore } from '../store/useUIStore';
import { Card, Empty, IconButton, Pills } from './ui';

const COLS: { id: TaskStatus; label: string }[] = [{ id: 'todo', label: 'To do' }, { id: 'in_progress', label: 'In progress' }, { id: 'completed', label: 'Done' }];

function useVisibleTasks(date: string, project: string) {
  const tasks = useAppStore((s) => s.tasks);
  const projects = useAppStore((s) => s.projects);
  return useMemo(() => {
    const p = projects.find((x) => x.name === project);
    return tasks
      .filter((t) => t.status !== 'archived')
      .filter((t) => (t.completed ? t.dueDate === date : true))
      .filter((t) => project === 'All' || t.projectId === p?.id)
      .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.dueDate.localeCompare(b.dueDate));
  }, [tasks, projects, date, project]);
}

function ProjectFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const projects = useAppStore((s) => s.projects);
  return <Pills options={['All', ...projects.map((p) => p.name)] as readonly string[]} value={value} onChange={onChange} />;
}

export function KanbanBoard({ date }: { date: string }) {
  const [project, setProject] = useState('All');
  const tasks = useVisibleTasks(date, project);
  const open = useUIStore((s) => s.open);
  return (
    <div className="col">
      <ProjectFilter value={project} onChange={setProject} />
      <div className="kanban hide-scroll">
        {COLS.map((col, ci) => {
          const items = tasks.filter((t) => (col.id === 'completed' ? t.completed : !t.completed && t.status === col.id));
          return (
            <Card key={col.id} recessed className="col" style={{ minHeight: 180 }}>
              <div className="row between"><span className="label">{col.label}</span><span className="tag">{items.length}</span></div>
              {items.length === 0 && <span className="small muted">Nothing here.</span>}
              {items.map((t) => (
                <Card key={t.id} style={{ padding: 12 }}>
                  <div className="row" style={{ alignItems: 'flex-start' }}>
                    <span className={`prio ${t.priority}`} style={{ minHeight: 34 }} />
                    <button type="button" className="grow" style={{ textAlign: 'left' }} onClick={() => open('task', { id: t.id })}>
                      <div style={{ fontWeight: 600 }}>{t.title}</div>
                      <div className="tiny muted num">{t.dueDate === todayStr() ? 'Today' : t.dueDate}</div>
                    </button>
                  </div>
                  <div className="row between" style={{ marginTop: 8 }}>
                    <IconButton sm label="Move left" disabled={ci === 0} onClick={() => setStatus(t.id, COLS[ci - 1].id)} style={{ opacity: ci === 0 ? 0.35 : 1 }}><ArrowLeft size={16} /></IconButton>
                    <IconButton sm label="Move right" disabled={ci === COLS.length - 1} onClick={() => setStatus(t.id, COLS[ci + 1].id)} style={{ opacity: ci === COLS.length - 1 ? 0.35 : 1 }}><ArrowRight size={16} /></IconButton>
                  </div>
                </Card>
              ))}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

const QUADS: { id: Quadrant; title: string; sub: string; color: string }[] = [
  { id: 'do', title: 'Do first', sub: 'Important · Urgent', color: 'var(--accent)' },
  { id: 'schedule', title: 'Schedule', sub: 'Important · Not urgent', color: 'var(--info)' },
  { id: 'delegate', title: 'Quick wins', sub: 'Not important · Urgent', color: 'var(--warn)' },
  { id: 'eliminate', title: 'Eliminate', sub: 'Not important · Not urgent', color: 'var(--muted)' },
];

export function EisenhowerMatrix({ date }: { date: string }) {
  const [project, setProject] = useState('All');
  const tasks = useVisibleTasks(date, project).filter((t) => !t.completed);
  const open = useUIStore((s) => s.open);
  const toggle = useAppStore((s) => s.toggleTask);
  return (
    <div className="col">
      <ProjectFilter value={project} onChange={setProject} />
      <p className="tiny muted">Important = high priority. Urgent = due within 2 days or overdue.</p>
      <div className="matrix">
        {QUADS.map((q) => {
          const items = tasks.filter((t) => quadrantOf(t) === q.id);
          return (
            <div key={q.id} className="cell">
              <div><div className="label" style={{ color: q.color }}>{q.title}</div><div className="tiny muted">{q.sub}</div></div>
              {items.length === 0 && <span className="tiny muted">Empty</span>}
              {items.slice(0, 8).map((t: Task) => (
                <div key={t.id} className="mini-task">
                  <input type="checkbox" className="tick" style={{ width: 22, height: 22 }} checked={false} onChange={() => toggle(t.id)} aria-label={`Complete ${t.title}`} />
                  <button type="button" className="grow truncate" style={{ textAlign: 'left' }} onClick={() => open('task', { id: t.id })}>{t.title}</button>
                </div>
              ))}
              {items.length > 8 && <span className="tiny muted">+{items.length - 8} more</span>}
            </div>
          );
        })}
      </div>
      {tasks.length === 0 && <Empty title="Inbox zero" text="No open tasks to prioritise." />}
    </div>
  );
}
