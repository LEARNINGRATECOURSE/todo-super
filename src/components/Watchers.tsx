import { useEffect } from 'react';
import { chime } from '../lib/audio';
import { nowTimeStr, todayStr } from '../lib/dates';
import { notify } from '../lib/notifications';
import { haptic } from '../lib/util';
import { isScheduledOn, slotsFor, logFor, checkinsOf } from '../repo/habitRepository';
import { db } from '../db/database';
import { writeWidgetData } from '../lib/widgetService';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { syncAmbient, usePomodoroStore } from '../store/usePomodoroStore';
import { useUIStore } from '../store/useUIStore';

/** Fires rest-timer alerts, pomodoro completion, due reminders and keeps the widget snapshot fresh. */
export function Watchers() {
  // Rest timer: chime + haptic + notification when it elapses, even if the modal is minimised.
  useEffect(() => {
    const t = setInterval(() => {
      const a = useWorkoutStore.getState().active;
      if (a?.restEndsAt && a.restEndsAt <= Date.now()) {
        useWorkoutStore.getState().skipRest();
        chime('rest');
        haptic([120, 80, 120]);
        useUIStore.getState().toast('Rest over — next set!', { tone: 'success' });
        if (document.visibilityState === 'hidden' && db.get('app_settings', 'notifications')?.value === '1') void notify('Rest over', 'Time for your next set.', 'rest');
      }
    }, 500);
    return () => clearInterval(t);
  }, []);

  // Pomodoro completion + ambient audio lifecycle.
  useEffect(() => {
    const t = setInterval(() => {
      const p = usePomodoroStore.getState();
      if (p.running && p.endsAt && p.endsAt <= Date.now()) { p.complete(); syncAmbient(); }
    }, 500);
    const resume = () => { const p = usePomodoroStore.getState(); if (p.running && p.endsAt && p.endsAt <= Date.now()) { p.complete(); } syncAmbient(); };
    document.addEventListener('visibilitychange', resume);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', resume); };
  }, []);

  // Reminders for tasks + habit slots (once per day per item).
  useEffect(() => {
    const fired = new Set<string>(JSON.parse(sessionStorage.getItem('tf.fired') ?? '[]'));
    const fire = (key: string, title: string, body: string) => {
      if (fired.has(key)) return;
      fired.add(key);
      sessionStorage.setItem('tf.fired', JSON.stringify([...fired].slice(-200)));
      useUIStore.getState().toast(`${title}: ${body}`, { tone: 'info' });
      if (db.get('app_settings', 'notifications')?.value === '1') void notify(title, body, key);
      haptic([30, 40, 30]);
    };
    const check = () => {
      const date = todayStr();
      const now = nowTimeStr();
      for (const t of db.all('tasks')) {
        if (!t.completed && t.dueDate === date && t.reminderTime === now) fire(`task:${t.id}:${date}:${now}`, 'Task reminder', t.title);
      }
      for (const h of db.all('habits')) {
        if (h.archived || !isScheduledOn(h, date)) continue;
        const log = logFor(h.id, date);
        if (log?.completed || log?.isFrozen) continue;
        const slots = slotsFor(h);
        if (slots.length) {
          if (slots.includes(now) && !checkinsOf(log).includes(now)) fire(`habit:${h.id}:${date}:${now}`, `${h.icon} ${h.name}`, 'Time to check in');
        } else if (h.reminderTime === now) fire(`habit:${h.id}:${date}:${now}`, `${h.icon} ${h.name}`, 'Habit reminder');
      }
    };
    check();
    const t = setInterval(check, 20000);
    return () => clearInterval(t);
  }, []);

  // Widget snapshot (debounced on data changes).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const off = db.onChange(() => { clearTimeout(timer); timer = setTimeout(() => writeWidgetData(), 1500); });
    return () => { clearTimeout(timer); off(); };
  }, []);

  return null;
}
