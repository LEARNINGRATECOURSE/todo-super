import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { DayChips } from '../components/DayChips';
import { Button, Field, IconButton, NumberStepper, Segmented, Select, Sheet, TextArea, TextInput } from '../components/ui';
import type { Priority, RecurringRule } from '../db/types';
import { todayStr } from '../lib/dates';
import { parseJSON } from '../lib/util';
import { createProject, createTask, setSubtasks, subtasksOf, updateTask } from '../repo/taskRepository';
import { useAppStore } from '../store/useAppStore';
import { useUIStore } from '../store/useUIStore';

const CATEGORIES = ['Work', 'Personal', 'Health', 'Learning', 'Errands', 'Finance'];
const RULES: { value: RecurringRule; label: string }[] = [
  { value: 'none', label: 'Does not repeat' }, { value: 'daily', label: 'Daily' }, { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }, { value: 'custom', label: 'Custom days' },
];

export function TaskEditor({ id, date }: { id?: string; date?: string }) {
  const close = useUIStore((s) => s.close);
  const toast = useUIStore((s) => s.toast);
  const existing = useAppStore((s) => s.tasks).find((t) => t.id === id);
  const projects = useAppStore((s) => s.projects);
  const { removeTasks, toggleTask } = useAppStore.getState();
  const [f, setF] = useState(() => ({
    title: existing?.title ?? '', description: existing?.description ?? '', dueDate: existing?.dueDate ?? date ?? todayStr(),
    startTime: existing?.startTime ?? '', endTime: existing?.endTime ?? '', dueTime: existing?.dueTime ?? '',
    estimatedMinutes: existing?.estimatedMinutes ?? 30, priority: (existing?.priority ?? 'medium') as Priority,
    category: existing?.category ?? 'Work', projectId: existing?.projectId ?? '', recurringRule: (existing?.recurringRule ?? 'none') as RecurringRule,
    recurrenceEndDate: existing?.recurrenceEndDate ?? '', recurrenceDays: parseJSON<string[]>(existing?.recurrenceDays, []).map(Number),
    reminderTime: existing?.reminderTime ?? '',
  }));
  const [subs, setSubs] = useState<{ title: string; completed: boolean }[]>(() => (id ? subtasksOf(id).map((s) => ({ title: s.title, completed: !!s.completed })) : []));
  const [newSub, setNewSub] = useState('');
  const [newProject, setNewProject] = useState('');
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const save = () => {
    if (!f.title.trim()) { toast('Give the task a title', { tone: 'warn' }); return; }
    if (f.startTime && f.endTime && f.endTime <= f.startTime) { toast('End time must be after start time', { tone: 'warn' }); return; }
    const payload = {
      title: f.title.trim(), description: f.description || null, dueDate: f.dueDate, startTime: f.startTime || null, endTime: f.startTime && f.endTime ? f.endTime : null,
      dueTime: f.startTime ? null : f.dueTime || null,
      estimatedMinutes: f.startTime && f.endTime ? Math.max(5, (Number(f.endTime.slice(0, 2)) * 60 + Number(f.endTime.slice(3))) - (Number(f.startTime.slice(0, 2)) * 60 + Number(f.startTime.slice(3)))) : f.estimatedMinutes,
      priority: f.priority, category: f.category, projectId: f.projectId || null, recurringRule: f.recurringRule,
      recurrenceEndDate: f.recurringRule === 'none' ? null : f.recurrenceEndDate || null,
      recurrenceDays: f.recurringRule === 'custom' ? JSON.stringify(f.recurrenceDays.map(String)) : null, reminderTime: f.reminderTime || null,
    };
    if (existing) {
      updateTask(existing.id, payload);
      setSubtasks(existing.id, subs);
    } else {
      const t = createTask(payload, []);
      setSubtasks(t.id, subs);
    }
    toast(existing ? 'Task updated' : 'Task added', { tone: 'success' });
    close('task');
  };

  const addProject = () => {
    if (!newProject.trim()) return;
    const colors = ['#2f6fed', '#27a860', '#8b5cf6', '#f26b1d', '#ff4757', '#06b6d4'];
    const p = createProject(newProject, colors[projects.length % colors.length]);
    set('projectId', p.id);
    setNewProject('');
  };

  return (
    <Sheet
      title={existing ? 'Edit task' : 'New task'} onClose={() => close('task')}
      footer={<>
        {existing && <Button onClick={() => { removeTasks([existing.id]); close('task'); }} aria-label="Delete task"><Trash2 size={16} /></Button>}
        {existing && <Button onClick={() => { toggleTask(existing.id); close('task'); }}>{existing.completed ? 'Reopen' : 'Complete'}</Button>}
        <Button block variant="primary" onClick={save}>Save</Button>
      </>}
    >
      <Field label="Title"><TextInput autoFocus={!existing} value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="What needs doing?" onKeyDown={(e) => e.key === 'Enter' && save()} /></Field>
      <Field label="Notes"><TextArea value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Optional details" style={{ minHeight: 80 }} /></Field>
      <Field label="Priority"><Segmented<Priority> value={f.priority} onChange={(v) => set('priority', v)} options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]} /></Field>
      <div className="grid2">
        <Field label="Due date"><TextInput type="date" value={f.dueDate} onChange={(e) => set('dueDate', e.target.value || todayStr())} /></Field>
        <Field label="Reminder"><TextInput type="time" value={f.reminderTime} onChange={(e) => set('reminderTime', e.target.value)} /></Field>
        <Field label="Start (time block)"><TextInput type="time" value={f.startTime} onChange={(e) => set('startTime', e.target.value)} /></Field>
        <Field label="End"><TextInput type="time" value={f.endTime} onChange={(e) => set('endTime', e.target.value)} /></Field>
      </div>
      {!f.startTime && <Field label="Or due at" hint="Used to place the task on the timeline without blocking time."><TextInput type="time" value={f.dueTime} onChange={(e) => set('dueTime', e.target.value)} /></Field>}
      {!(f.startTime && f.endTime) && <Field label="Estimate (minutes)"><NumberStepper value={f.estimatedMinutes} onChange={(n) => set('estimatedMinutes', n)} step={5} min={5} max={600} /></Field>}
      <div className="grid2">
        <Field label="Category"><Select value={f.category} onChange={(e) => set('category', e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field label="Project"><Select value={f.projectId} onChange={(e) => set('projectId', e.target.value)}><option value="">None</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
      </div>
      <div className="row">
        <TextInput placeholder="New project name" value={newProject} onChange={(e) => setNewProject(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addProject()} />
        <Button onClick={addProject} sm><Plus size={14} /> Add</Button>
      </div>
      <Field label="Repeat"><Select value={f.recurringRule} onChange={(e) => set('recurringRule', e.target.value as RecurringRule)}>{RULES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</Select></Field>
      {f.recurringRule === 'custom' && <Field label="On days"><DayChips value={f.recurrenceDays} onChange={(v) => set('recurrenceDays', v)} /></Field>}
      {f.recurringRule !== 'none' && <Field label="Ends on (optional)"><TextInput type="date" value={f.recurrenceEndDate} onChange={(e) => set('recurrenceEndDate', e.target.value)} /></Field>}
      <div className="field">
        <span className="label">Subtasks</span>
        {subs.map((s, i) => (
          <div key={i} className="row">
            <input type="checkbox" className="tick" checked={s.completed} aria-label="Done" onChange={() => setSubs(subs.map((x, j) => (j === i ? { ...x, completed: !x.completed } : x)))} />
            <TextInput value={s.title} onChange={(e) => setSubs(subs.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
            <IconButton sm label="Remove subtask" onClick={() => setSubs(subs.filter((_, j) => j !== i))}><Trash2 size={16} /></IconButton>
          </div>
        ))}
        <div className="row">
          <TextInput placeholder="Add a subtask" value={newSub} onChange={(e) => setNewSub(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newSub.trim()) { setSubs([...subs, { title: newSub.trim(), completed: false }]); setNewSub(''); } }} />
          <IconButton label="Add subtask" onClick={() => { if (newSub.trim()) { setSubs([...subs, { title: newSub.trim(), completed: false }]); setNewSub(''); } }}><Plus size={18} /></IconButton>
        </div>
      </div>
    </Sheet>
  );
}
