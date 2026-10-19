import { useRef, useState } from 'react';
import { Bell, Check, Clock, Pencil, Repeat, Trash2 } from 'lucide-react';
import type { Task } from '../db/types';
import { fmtDuration, fmtShort, fmtTime12, todayStr } from '../lib/dates';
import { cx, haptic } from '../lib/util';
import { useAppStore } from '../store/useAppStore';
import { useUIStore } from '../store/useUIStore';
import { toggleSubtask } from '../repo/taskRepository';
import { IconButton } from './ui';

interface Props {
  task: Task;
  selectMode: boolean;
  selected: boolean;
  onLongPress: (id: string) => void;
  onToggleSelect: (id: string) => void;
  overdue?: boolean;
}

const THRESH = 88;

export function SwipeableTaskItem({ task, selectMode, selected, onLongPress, onToggleSelect, overdue }: Props) {
  const [dx, setDx] = useState(0);
  const [drag, setDrag] = useState(false);
  const [open, setOpen] = useState(false);
  const st = useRef({ x: 0, y: 0, locked: false, moved: false, long: false, timer: 0 as unknown as ReturnType<typeof setTimeout>, id: -1 });
  const subtasks = useAppStore((s) => s.subtasks).filter((x) => x.taskId === task.id).sort((a, b) => a.order - b.order);
  const projects = useAppStore((s) => s.projects);
  const project = projects.find((p) => p.id === task.projectId);
  const { toggleTask, removeTasks } = useAppStore.getState();
  const openModal = useUIStore((s) => s.open);

  const down = (e: React.PointerEvent) => {
    // The title header is a button for keyboard users but must still start swipes/long-presses.
    if ((e.target as HTMLElement).closest('button:not(.task-head), input, select')) return;
    const s = st.current;
    s.x = e.clientX; s.y = e.clientY; s.locked = false; s.moved = false; s.long = false; s.id = e.pointerId;
    clearTimeout(s.timer);
    s.timer = setTimeout(() => { if (!s.moved) { s.long = true; haptic(25); onLongPress(task.id); } }, 450);
  };
  const move = (e: React.PointerEvent) => {
    const s = st.current;
    if (s.id !== e.pointerId) return;
    const ddx = e.clientX - s.x, ddy = e.clientY - s.y;
    if (!s.locked) {
      if (Math.abs(ddx) > 8 && Math.abs(ddx) > Math.abs(ddy)) { s.locked = true; s.moved = true; clearTimeout(s.timer); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setDrag(true); }
      else if (Math.abs(ddy) > 8) { s.moved = true; clearTimeout(s.timer); }
      else return;
    }
    if (s.locked && !selectMode) setDx(Math.max(-140, Math.min(140, ddx)));
  };
  const up = (e: React.PointerEvent) => {
    const s = st.current;
    if (s.id !== e.pointerId) return;
    clearTimeout(s.timer);
    s.id = -1;
    if (s.locked) {
      setDrag(false);
      if (dx > THRESH) toggleTask(task.id);
      else if (dx < -THRESH) removeTasks([task.id]);
      setDx(0);
    }
  };
  const click = () => {
    const s = st.current;
    if (s.moved || s.long) { s.moved = false; s.long = false; return; }
    if (selectMode) onToggleSelect(task.id);
    else setOpen((o) => !o);
  };

  const time = task.startTime ?? task.dueTime;
  const meta: string[] = [];
  if (time) meta.push(task.endTime && task.startTime ? `${fmtTime12(task.startTime)} – ${fmtTime12(task.endTime)}` : fmtTime12(time));
  meta.push(fmtDuration(task.estimatedMinutes));
  const doneSubs = subtasks.filter((x) => x.completed).length;

  return (
    <div className="swipe">
      <div className="swipe-bg" style={{ background: dx >= 0 ? 'var(--ok)' : 'var(--accent)' }} aria-hidden>
        <span className="row"><Check size={18} /> Complete</span>
        <span className="row">Delete <Trash2 size={18} /></span>
      </div>
      <div
        className={cx('swipe-fg', drag && 'dragging')} style={{ transform: `translateX(${dx}px)` }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onContextMenu={(e) => e.preventDefault()}
      >
        <div className={cx('task', selected && 'selected')} onClick={click}>
          {selectMode ? (
            // stopPropagation: the click would otherwise also reach the row's handler and toggle the selection a second time.
            <input type="checkbox" className="tick" checked={selected} onChange={() => onToggleSelect(task.id)} onClick={(e) => e.stopPropagation()} aria-label={`Select ${task.title}`} />
          ) : (
            <button type="button" className={cx('check', task.completed && 'on')} aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'} aria-pressed={!!task.completed}
              onClick={(e) => { e.stopPropagation(); toggleTask(task.id); }}>
              <Check size={18} strokeWidth={3} />
            </button>
          )}
          <span className={cx('prio', task.priority)} aria-label={`${task.priority} priority`} />
          <div className="grow">
            {/* Focusable header: Enter/Space bubbles to the row's click handler; Delete removes the task. */}
            <button type="button" className="task-head" aria-expanded={open} onKeyDown={(e) => { if (e.key === 'Delete') removeTasks([task.id]); }}>
            <span className={cx(task.completed && 'strike')} style={{ fontWeight: 600, display: 'block' }}>{task.title}</span>
            <span className="row wrap tiny muted" style={{ gap: 8, marginTop: 2 }}>
              <span className="num row" style={{ gap: 4 }}><Clock size={12} /> {meta.join(' · ')}</span>
              {overdue && <span className="tag hot">Overdue · {fmtShort(task.dueDate)}</span>}
              {task.dueDate !== todayStr() && !overdue && <span className="num">{fmtShort(task.dueDate)}</span>}
              {task.recurringRule !== 'none' && <Repeat size={12} aria-label="Recurring" />}
              {task.reminderTime && <Bell size={12} aria-label="Reminder" />}
              {project && <span className="tag" style={{ color: project.color }}>{project.name}</span>}
              {subtasks.length > 0 && <span className="num">{doneSubs}/{subtasks.length}</span>}
            </span>
            </button>
            {open && (
              <div onClick={(e) => e.stopPropagation()}>
                {task.description && <p className="small muted" style={{ marginTop: 8 }}>{task.description}</p>}
                {subtasks.length > 0 && (
                  <ul className="subs">
                    {subtasks.map((s) => (
                      <li key={s.id}>
                        <input type="checkbox" className="tick" checked={!!s.completed} onChange={() => toggleSubtask(s.id)} aria-label={s.title} />
                        <span className={cx(s.completed && 'strike')}>{s.title}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="row" style={{ marginTop: 10 }}>
                  <IconButton sm label="Edit task" onClick={() => openModal('task', { id: task.id })}><Pencil size={16} /></IconButton>
                  <IconButton sm label="Delete task" onClick={() => removeTasks([task.id])}><Trash2 size={16} /></IconButton>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
