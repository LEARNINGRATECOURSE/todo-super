import { Check, Download } from 'lucide-react';
import { Button, Card, Sheet, Tag } from '../components/ui';
import { PROGRAMS } from '../data/programs';
import { DAY_SHORT } from '../lib/dates';
import { importProgram } from '../repo/workoutRepository';
import { getSetting, setSetting } from '../repo/settings';
import { useUIStore } from '../store/useUIStore';
import { useWorkoutStore } from '../store/useWorkoutStore';

export function ProgramCatalog() {
  const close = useUIStore((s) => s.close);
  const toast = useUIStore((s) => s.toast);
  const routines = useWorkoutStore((s) => s.routines);
  return (
    <Sheet title="Program catalog" onClose={() => close('programs')}>
      <p className="small muted">Six proven programs. Importing creates an editable routine; your existing routines are untouched.</p>
      {PROGRAMS.map((p) => {
        const have = routines.some((r) => r.name === p.name);
        return (
          <Card key={p.id} screws vents>
            <div className="col" style={{ gap: 10 }}>
              <div className="row wrap" style={{ gap: 6, paddingRight: 48 }}><Tag>{p.folder}</Tag><Tag>{p.level}</Tag></div>
              <strong style={{ fontSize: '1.1rem' }}>{p.name}</strong>
              <p className="small muted">{p.description}</p>
              <div className="row wrap num small" style={{ gap: 12 }}><span>{p.daysPerWeek}-day split</span><span>{p.weeks} weeks</span><span>{p.goal}</span></div>
              <div className="row wrap" style={{ gap: 6 }}>{p.days.map((d) => <span key={d.name} className="tag">{d.name}</span>)}</div>
              <div className="tiny muted num">Trains {p.scheduleDays.map((d) => DAY_SHORT[d]).join(' · ')}</div>
              <Button variant={have ? 'secondary' : 'primary'} onClick={() => {
                importProgram(p);
                if (!getSetting('activeRoutineId')) setSetting('activeRoutineId', useWorkoutStore.getState().routines[0]?.id ?? '');
                toast(have ? 'Imported another copy' : `${p.name} imported`, { tone: 'success' });
              }}>
                {have ? <><Check size={16} /> Imported — add again</> : <><Download size={16} /> Import program</>}
              </Button>
            </div>
          </Card>
        );
      })}
    </Sheet>
  );
}
