import { useState } from 'react';
import { Field, NumInput, Sheet } from '../components/ui';
import { brzycki, epley, estimate1RM, percentChart } from '../lib/oneRepMax';
import { fmtWeight } from '../lib/units';
import { useUnit } from '../store/useAppStore';
import { useUIStore } from '../store/useUIStore';

export function OneRmCalculator() {
  const close = useUIStore((s) => s.close);
  const unit = useUnit();
  const [w, setW] = useState(unit === 'kg' ? 100 : 225);
  const [r, setR] = useState(5);
  const blend = estimate1RM(w, r);
  return (
    <Sheet title="1RM estimator" onClose={() => close('oneRm')}>
      <div className="grid2">
        <Field label={`Weight (${unit})`}><NumInput compact={false} value={w} onChange={setW} label="Weight" /></Field>
        <Field label="Reps"><NumInput compact={false} value={r} onChange={(n) => setR(Math.round(n))} max={30} label="Reps" /></Field>
      </div>
      <div className="screen-inset" style={{ padding: 18, textAlign: 'center' }}>
        <div className="label" style={{ color: '#8cf0b4', textShadow: 'none', position: 'relative', zIndex: 1 }}>Estimated 1RM (blend)</div>
        <div className="num" style={{ fontSize: '2.4rem', fontWeight: 700, position: 'relative', zIndex: 1 }}>{fmtWeight(Math.round(blend * 10) / 10)} {unit}</div>
      </div>
      <div className="grid2">
        <div className="card"><span className="label">Epley</span><div className="num" style={{ fontWeight: 700 }}>{fmtWeight(Math.round(epley(w, r) * 10) / 10)} {unit}</div><div className="tiny muted">w·(1 + r/30)</div></div>
        <div className="card"><span className="label">Brzycki</span><div className="num" style={{ fontWeight: 700 }}>{fmtWeight(Math.round(brzycki(w, r) * 10) / 10)} {unit}</div><div className="tiny muted">w·36/(37 − r)</div></div>
      </div>
      <div className="col" style={{ gap: 6 }}>
        <span className="label">Percentage chart</span>
        {percentChart(blend).map((p) => (
          <div key={p.pct} className="row" style={{ gap: 12 }}>
            <span className="num" style={{ width: 44, fontWeight: 700 }}>{p.pct}%</span>
            <div className="grow bar"><i style={{ width: `${p.pct}%` }} /></div>
            <span className="num" style={{ width: 84, textAlign: 'right' }}>{fmtWeight(Math.round(p.weight * 10) / 10)} {unit}</span>
            <span className="num tiny muted" style={{ width: 40, textAlign: 'right' }}>~{p.reps}r</span>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
