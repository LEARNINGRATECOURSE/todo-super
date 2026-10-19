import { CheckCircle2, Dumbbell, Flame } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, Ring, Sheet } from '../components/ui';
import { fmtTime12 } from '../lib/dates';
import { downloadWidgetData, writeWidgetData } from '../lib/widgetService';
import { useUIStore } from '../store/useUIStore';

export function WidgetPreview() {
  const close = useUIStore((s) => s.close);
  const toast = useUIStore((s) => s.toast);
  const [data, setData] = useState(() => writeWidgetData());
  const refresh = () => { setData(writeWidgetData()); toast('Widget snapshot refreshed', { tone: 'success' }); };
  const pct = data.habits.total ? data.habits.done / data.habits.total : 0;
  const w = { done: 'Workout done', planned: data.workout.day ?? 'Workout planned', rest: 'Rest day', skipped: 'Skipped' }[data.workout.status];

  return (
    <Sheet title="Widget bridge" onClose={() => close('widget')} footer={<><Button block onClick={refresh}>Refresh</Button><Button block variant="primary" onClick={downloadWidgetData}>Export JSON</Button></>}>
      <p className="small muted">TaskFlow writes a daily snapshot to <code className="mono">widget-data.json</code>. Native widgets (planned) and Shortcuts can read it. Preview of the three layouts:</p>
      <span className="label">Small</span>
      <div className="card widget-small screen-inset" style={{ padding: 14, color: '#fff' }}>
        <div className="col" style={{ position: 'relative', zIndex: 1, height: '100%', justifyContent: 'space-between' }}>
          <span className="label" style={{ color: '#8cf0b4', textShadow: 'none' }}>Today</span>
          <div className="num" style={{ fontSize: '2rem', fontWeight: 700 }}>{data.tasksDone}<span style={{ opacity: 0.5 }}>/{data.tasksTotal}</span></div>
          <span className="small">tasks done</span>
        </div>
      </div>
      <span className="label">Medium</span>
      <Card dark className="widget-medium" style={{ padding: 14 }}>
        <div className="row" style={{ height: '100%', gap: 14 }}>
          <Ring value={pct} size={72} stroke={9} track="#454d50"><span className="num" style={{ fontWeight: 700 }}>{Math.round(pct * 100)}%</span></Ring>
          <div className="col grow" style={{ gap: 4, minWidth: 0 }}>
            {data.tasks.slice(0, 3).map((t) => <div key={t.id} className="row small truncate" style={{ gap: 6 }}><CheckCircle2 size={14} color="#ff4757" /><span className="truncate">{t.title}</span></div>)}
            {data.tasks.length === 0 && <span className="small" style={{ color: '#a8b2d1' }}>Nothing left today 🎉</span>}
            <div className="row small" style={{ gap: 6, color: '#a8b2d1' }}><Dumbbell size={14} /> {w}</div>
          </div>
        </div>
      </Card>
      <span className="label">Lock screen</span>
      <Card className="widget-lock" style={{ padding: 14 }}>
        <div className="col" style={{ gap: 6 }}>
          <div className="row between"><strong>{data.tasks[0] ? data.tasks[0].title : 'All clear'}</strong>{data.tasks[0]?.time && <span className="num small">{fmtTime12(data.tasks[0].time)}</span>}</div>
          <div className="row small muted" style={{ gap: 12 }}><span className="row" style={{ gap: 4 }}><Flame size={14} /> {data.habits.done}/{data.habits.total} habits</span><span className="row" style={{ gap: 4 }}><Dumbbell size={14} /> {w}</span></div>
          {data.insight && <p className="tiny muted">“{data.insight}”</p>}
        </div>
      </Card>
      <details><summary className="label" style={{ cursor: 'pointer' }}>Raw JSON</summary>
        <pre className="mono tiny" style={{ overflow: 'auto', background: '#2d3436', color: '#e0e5ec', padding: 12, borderRadius: 8 }}>{JSON.stringify(data, null, 2)}</pre>
      </details>
    </Sheet>
  );
}
