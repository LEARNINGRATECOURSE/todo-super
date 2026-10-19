import { Camera, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { LineChart } from '../components/Charts';
import { Button, Card, Field, IconButton, NumInput, Sheet, TextArea, TextInput } from '../components/ui';
import { fmtShort, todayStr } from '../lib/dates';
import { convert } from '../lib/units';
import { deleteMeasurement, saveMeasurement } from '../repo/workoutRepository';
import { useUnit } from '../store/useAppStore';
import { useUIStore } from '../store/useUIStore';
import { useWorkoutStore } from '../store/useWorkoutStore';

/** Downscale a photo to a small JPEG data URI so it fits comfortably in local storage. */
async function shrink(file: File, max = 480): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.6);
}
const FIELDS = ['chest', 'waist', 'hips', 'biceps', 'thighs', 'calves'] as const;

export function BodyMeasurements() {
  const close = useUIStore((s) => s.close);
  const toast = useUIStore((s) => s.toast);
  const unit = useUnit();
  const list = useWorkoutStore((s) => s.measurements);
  const lenUnit = unit === 'kg' ? 'cm' : 'in';
  const toLen = (cm: number | null) => (cm == null ? 0 : unit === 'kg' ? cm : Math.round((cm / 2.54) * 10) / 10);
  const [f, setF] = useState({ date: todayStr(), weight: 0, bodyFat: 0, chest: 0, waist: 0, hips: 0, biceps: 0, thighs: 0, calves: 0, notes: '', photoUri: '' as string });
  const file = useRef<HTMLInputElement>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date));
  const trend = [...list].filter((m) => m.weight != null).sort((a, b) => a.date.localeCompare(b.date)).map((m) => ({ label: m.date, value: Math.round(convert(m.weight!, 'kg', unit) * 10) / 10 }));

  const save = () => {
    const any = f.weight || f.bodyFat || FIELDS.some((k) => f[k]) || f.photoUri || f.notes;
    if (!any) { toast('Enter at least one measurement', { tone: 'warn' }); return; }
    const cm = (n: number) => (n ? (unit === 'kg' ? n : Math.round(n * 2.54 * 10) / 10) : null);
    saveMeasurement({
      date: f.date, weight: f.weight ? Math.round(convert(f.weight, unit, 'kg') * 100) / 100 : null, bodyFat: f.bodyFat || null,
      chest: cm(f.chest), waist: cm(f.waist), hips: cm(f.hips), biceps: cm(f.biceps), thighs: cm(f.thighs), calves: cm(f.calves), notes: f.notes || null, photoUri: f.photoUri || null,
    });
    toast('Measurements saved', { tone: 'success' });
    setF({ ...f, weight: 0, bodyFat: 0, chest: 0, waist: 0, hips: 0, biceps: 0, thighs: 0, calves: 0, notes: '', photoUri: '' });
  };

  return (
    <Sheet title="Body metrics" onClose={() => close('body')} footer={<Button block variant="primary" onClick={save}>Save entry</Button>}>
      {trend.length > 1 && <Card screws><div className="col"><span className="label">Weight trend ({unit})</span><LineChart data={trend} /></div></Card>}
      <Field label="Date"><TextInput type="date" value={f.date} onChange={(e) => set('date', e.target.value || todayStr())} /></Field>
      <div className="grid2">
        <Field label={`Weight (${unit})`}><NumInput compact={false} value={f.weight || null} placeholder="0" onChange={(n) => set('weight', n)} /></Field>
        <Field label="Body fat (%)"><NumInput compact={false} value={f.bodyFat || null} placeholder="0" onChange={(n) => set('bodyFat', n)} max={70} /></Field>
        {FIELDS.map((k) => <Field key={k} label={`${k[0].toUpperCase()}${k.slice(1)} (${lenUnit})`}><NumInput compact={false} value={f[k] || null} placeholder="0" onChange={(n) => set(k, n)} /></Field>)}
      </div>
      <Field label="Notes"><TextArea style={{ minHeight: 70 }} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
      <div className="row">
        <input ref={file} type="file" accept="image/*" capture="environment" hidden onChange={async (e) => { const fl = e.target.files?.[0]; if (fl) { try { set('photoUri', await shrink(fl)); } catch { toast('Could not read that photo', { tone: 'warn' }); } } e.target.value = ''; }} />
        <Button onClick={() => file.current?.click()}><Camera size={16} /> {f.photoUri ? 'Replace photo' : 'Add progress photo'}</Button>
        {f.photoUri && <img src={f.photoUri} alt="Progress preview" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }} />}
        {f.photoUri && <IconButton sm label="Remove photo" onClick={() => set('photoUri', '')}><Trash2 size={16} /></IconButton>}
      </div>
      <span className="label">History</span>
      {sorted.length === 0 && <span className="small muted">No entries yet.</span>}
      {sorted.map((m) => (
        <Card key={m.id} style={{ padding: 12 }}>
          <div className="row">
            {m.photoUri && <img src={m.photoUri} alt={`Progress ${m.date}`} style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 8 }} />}
            <div className="grow">
              <strong className="num">{fmtShort(m.date)}</strong>
              <div className="small muted num">
                {[m.weight != null && `${Math.round(convert(m.weight, 'kg', unit) * 10) / 10} ${unit}`, m.bodyFat != null && `${m.bodyFat}% bf`, m.waist != null && `waist ${toLen(m.waist)} ${lenUnit}`, m.chest != null && `chest ${toLen(m.chest)} ${lenUnit}`].filter(Boolean).join(' · ')}
              </div>
            </div>
            <IconButton sm label="Delete entry" onClick={() => deleteMeasurement(m.id)}><Trash2 size={16} /></IconButton>
          </div>
        </Card>
      ))}
    </Sheet>
  );
}
