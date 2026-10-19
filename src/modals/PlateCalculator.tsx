import { useState } from 'react';
import { Field, NumInput, Segmented, Sheet } from '../components/ui';
import { DEFAULT_BAR, PLATES, calculatePlates } from '../lib/plates';
import { convert, fmtWeight, roundWeight, type Unit } from '../lib/units';
import { setUnit, useUnit } from '../store/useAppStore';
import { useUIStore } from '../store/useUIStore';

export function PlateCalculator({ target: initial }: { target?: number }) {
  const close = useUIStore((s) => s.close);
  const unit = useUnit();
  const [target, setTarget] = useState(initial ?? (unit === 'kg' ? 100 : 225));
  const [bar, setBar] = useState<number>(DEFAULT_BAR[unit]);
  const [custom, setCustom] = useState(false);
  const switchUnit = (u: Unit) => {
    if (u === unit) return;
    // Convert the entered numbers rather than resetting them, so a typed target survives the switch.
    setTarget(roundWeight(convert(target, unit, u), u));
    setBar(custom ? roundWeight(convert(bar, unit, u), u) : DEFAULT_BAR[u]);
    setUnit(u);
  };
  const r = calculatePlates(target, bar, unit);
  const flat = r.perSide.flatMap((p) => Array.from({ length: p.count }, () => p.plate));
  const bars = unit === 'kg' ? [20, 15, 10] : [45, 35, 25];

  return (
    <Sheet title="Plate calculator" onClose={() => close('plate')} z={75}>
      <Segmented<Unit> value={unit} onChange={switchUnit} options={[{ value: 'kg', label: 'KG' }, { value: 'lb', label: 'LB' }]} />
      <Field label={`Target weight (${unit})`}><NumInput compact={false} value={target} onChange={setTarget} label="Target weight" /></Field>
      <Field label="Barbell">
        <div className="seg">
          {bars.map((b) => <button key={b} type="button" aria-pressed={!custom && bar === b} onClick={() => { setBar(b); setCustom(false); }}>{b} {unit}</button>)}
          <button type="button" aria-pressed={custom} onClick={() => setCustom(true)}>Custom</button>
        </div>
      </Field>
      {custom && <Field label={`Bar weight (${unit})`}><NumInput compact={false} value={bar} onChange={setBar} label="Bar weight" /></Field>}

      <div className="screen-inset" style={{ padding: '22px 12px', overflowX: 'auto' }} role="img" aria-label={`Plates per side: ${r.perSide.map((p) => `${p.count} times ${p.plate.weight}`).join(', ') || 'none'}`}>
        <div className="row" style={{ gap: 0, minWidth: 'min-content', justifyContent: 'flex-start' }}>
          <div style={{ width: 22, height: 40, background: '#8a9099', borderRadius: 3 }} />
          <div style={{ width: 8, height: 62, background: '#c9ced6', borderRadius: 2, marginRight: 2 }} />
          {flat.map((p, i) => (
            <div key={i} className="plate" style={{ width: Math.max(12, 8 + p.weight * (unit === 'kg' ? 0.5 : 0.22)), height: p.height * 1.1, background: p.color, margin: '0 1px', display: 'grid', placeItems: 'center' }}>
              <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: p.color === '#f5f6f8' || p.color === '#f2c200' ? '#222' : '#fff', writingMode: 'vertical-rl' }}>{p.label}</span>
            </div>
          ))}
          <div style={{ height: 14, flex: 1, minWidth: 40, background: 'linear-gradient(#e7eaee,#9aa3ad)', borderRadius: 4 }} />
        </div>
        {flat.length === 0 && <div className="small" style={{ color: '#8cf0b4', position: 'relative', zIndex: 1, marginTop: 8 }}>{r.belowBar ? `Target is below the ${bar} ${unit} bar.` : 'Bar only.'}</div>}
      </div>

      <div className="col">
        <span className="label">Per side</span>
        {r.perSide.length === 0 && <span className="muted small">No plates needed.</span>}
        {r.perSide.map(({ plate, count }) => (
          <div key={plate.weight} className="row">
            <span className="plate" style={{ width: 28, height: 28, background: plate.color }} />
            <span className="grow num">{plate.weight} {unit}</span><strong className="num">× {count}</strong>
          </div>
        ))}
      </div>
      <div className="grid2">
        <div className="card"><span className="label">Loaded</span><div className="num" style={{ fontSize: '1.4rem', fontWeight: 700 }}>{fmtWeight(r.achieved)} {unit}</div></div>
        <div className="card"><span className="label">Remainder</span><div className="num" style={{ fontSize: '1.4rem', fontWeight: 700, color: r.remainder ? 'var(--accent)' : 'var(--ok)' }}>{r.belowBar ? '—' : r.remainder ? `${fmtWeight(r.remainder)} ${unit}` : 'Exact'}</div></div>
      </div>
      {r.remainder > 0 && <p className="small muted">Smallest plate is {PLATES[unit][PLATES[unit].length - 1].weight} {unit} per side, so {fmtWeight(r.remainder)} {unit} of the target cannot be loaded.</p>}
    </Sheet>
  );
}
