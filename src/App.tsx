import { CalendarDays, Dumbbell, Home, LayoutGrid, Repeat2, Trophy, WifiOff, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Watchers } from './components/Watchers';
import { Button, Card, Led } from './components/ui';
import { ActiveWorkoutModal } from './modals/ActiveWorkoutModal';
import { AchievementsModal } from './modals/Achievements';
import { BodyMeasurements } from './modals/BodyMeasurements';
import { ExercisePicker } from './modals/ExercisePicker';
import { HabitEditor } from './modals/HabitEditor';
import { NoteEditor } from './modals/NoteEditor';
import { OneRmCalculator } from './modals/OneRmCalculator';
import { PlateCalculator } from './modals/PlateCalculator';
import { ProgramCatalog } from './modals/ProgramCatalog';
import { RoutineEditor } from './modals/RoutineEditor';
import { SessionDetail, WorkoutSummary } from './modals/SessionModals';
import { SettingsModal } from './modals/Settings';
import { TaskEditor } from './modals/TaskEditor';
import { WidgetPreview } from './modals/WidgetPreview';
import { CalendarScreen } from './screens/Calendar';
import { HabitsScreen } from './screens/Habits';
import { MoreScreen } from './screens/More';
import { TodayScreen } from './screens/Today';
import { WorkoutScreen } from './screens/Workout';
import { useUIStore, type ModalEntry, type TabId } from './store/useUIStore';
import { useWorkoutStore } from './store/useWorkoutStore';

const TABS: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: 'today', label: 'Today', icon: Home },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'workout', label: 'Workout', icon: Dumbbell },
  { id: 'habits', label: 'Habits', icon: Repeat2 },
  { id: 'more', label: 'More', icon: LayoutGrid },
];

function ModalHost() {
  const modals = useUIStore((s) => s.modals);
  const render = (m: ModalEntry) => {
    const p = (m.props ?? {}) as Record<string, never>;
    switch (m.name) {
      case 'task': return <TaskEditor id={p.id} date={p.date} />;
      case 'habit': return <HabitEditor id={p.id} />;
      case 'routine': return <RoutineEditor id={p.id} />;
      case 'exercisePicker': return <ExercisePicker onPick={p.onPick} />;
      case 'activeWorkout': return <ActiveWorkoutModal />;
      case 'plate': return <PlateCalculator target={p.target} />;
      case 'oneRm': return <OneRmCalculator />;
      case 'programs': return <ProgramCatalog />;
      case 'body': return <BodyMeasurements />;
      case 'achievements': return <AchievementsModal />;
      case 'note': return <NoteEditor id={p.id} />;
      case 'widget': return <WidgetPreview />;
      case 'settings': return <SettingsModal />;
      case 'sessionDetail': return <SessionDetail id={p.id} />;
      case 'workoutSummary': return <WorkoutSummary id={p.id} prs={p.prs} />;
      default: return null;
    }
  };
  return <>{modals.map((m) => <div key={m.id}>{render(m)}</div>)}</>;
}

function Toasts() {
  const toasts = useUIStore((s) => s.toasts);
  const dismiss = useUIStore((s) => s.dismissToast);
  return createPortal(
    <div className="toasts" aria-live="polite" role="status">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone ?? 'info'}`}>
          <Led /> <span>{t.message}</span>
          {t.actionLabel && <button type="button" onClick={() => { t.onAction?.(); dismiss(t.id); }}>{t.actionLabel}</button>}
        </div>
      ))}
    </div>,
    document.body,
  );
}

function PRCelebration() {
  const pr = useWorkoutStore((s) => s.pr);
  const dismiss = useWorkoutStore((s) => s.dismissPR);
  useEffect(() => { if (!pr) return; const t = setTimeout(dismiss, 4500); return () => clearTimeout(t); }, [pr, dismiss]);
  if (!pr) return null;
  return createPortal(
    <div className="pr-pop" role="alertdialog" aria-label="New personal record" onClick={dismiss}>
      <Card dark screws elevated className="pr-card">
        <div className="col" style={{ alignItems: 'center', gap: 8 }}>
          <Trophy size={48} color="#ff4757" />
          <span className="label">New personal record</span>
          <strong style={{ fontSize: '1.4rem' }}>{pr.name}</strong>
          <span className="num" style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ff4757' }}>{pr.value}</span>
          <span className="small" style={{ color: '#a8b2d1' }}>{pr.kind === 'weight' ? 'Heaviest set ever' : 'Best single-set volume ever'}</span>
          <Button variant="primary" onClick={dismiss}>Let's go</Button>
        </div>
      </Card>
    </div>,
    document.body,
  );
}

function useOnline() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => {
    const a = () => setOn(true), b = () => setOn(false);
    window.addEventListener('online', a); window.addEventListener('offline', b);
    return () => { window.removeEventListener('online', a); window.removeEventListener('offline', b); };
  }, []);
  return on;
}

export default function App() {
  const tab = useUIStore((s) => s.tab);
  const setTab = useUIStore((s) => s.setTab);
  const open = useUIStore((s) => s.open);
  const active = useWorkoutStore((s) => s.active);
  const online = useOnline();
  const modalOpen = useUIStore((s) => s.modals.length > 0);
  const [bannerHidden, setBannerHidden] = useState(false);

  useEffect(() => { document.title = `TaskFlow Pro · ${TABS.find((t) => t.id === tab)?.label}`; }, [tab]);

  return (
    <div className="app">
      {!online && <span className="tag offline-pill row" style={{ gap: 4 }}><WifiOff size={12} /> Offline · all features work</span>}
      {tab === 'today' && <TodayScreen />}
      {tab === 'calendar' && <CalendarScreen />}
      {tab === 'workout' && <WorkoutScreen />}
      {tab === 'habits' && <HabitsScreen />}
      {tab === 'more' && <MoreScreen />}

      {active && !modalOpen && !bannerHidden && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 'calc(var(--tabbar-h) + var(--safe-bottom) + 22px)', zIndex: 34, display: 'flex', justifyContent: 'center', padding: '0 16px' }}>
          <Card dark elevated style={{ padding: 10, width: '100%', maxWidth: 560 }} onClick={() => open('activeWorkout')}>
            <div className="row"><Led color="red" pulse /><strong className="grow small">Workout in progress — tap to resume</strong>
              <button type="button" className="iconbtn sm" aria-label="Hide banner" onClick={(e) => { e.stopPropagation(); setBannerHidden(true); }}><X size={14} /></button></div>
          </Card>
        </div>
      )}

      <div className="tabbar">
        <nav aria-label="Primary">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className="tab" aria-current={tab === id ? 'page' : undefined} onClick={() => { setTab(id); window.scrollTo({ top: 0 }); }}>
              {tab === id && <Led color="red" />}
              <Icon size={22} strokeWidth={1.75} />
              {label}
            </button>
          ))}
        </nav>
      </div>

      <ModalHost />
      <PRCelebration />
      <Toasts />
      <Watchers />
    </div>
  );
}
