/** Minimal dependency-free SVG charts. */
interface Pt { label: string; value: number }

export function BarChart({ data, height = 120, color = 'var(--accent)', format }: { data: Pt[]; height?: number; color?: string; format?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100 / Math.max(1, data.length);
  return (
    <svg viewBox={`0 0 100 ${height / 2}`} preserveAspectRatio="none" width="100%" height={height} role="img" aria-label="Bar chart">
      {data.map((d, i) => {
        const h = (d.value / max) * (height / 2 - 14);
        return (
          <g key={i}>
            <rect x={i * w + w * 0.15} y={height / 2 - 10 - h} width={w * 0.7} height={Math.max(h, d.value ? 1 : 0)} rx={1.2} fill={color}><title>{`${d.label}: ${format ? format(d.value) : d.value}`}</title></rect>
            <text x={i * w + w / 2} y={height / 2 - 2} textAnchor="middle" fontSize={4} fill="var(--muted)" fontFamily="var(--font-mono)">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function LineChart({ data, height = 120, color = 'var(--accent)', unit = '' }: { data: Pt[]; height?: number; color?: string; unit?: string }) {
  if (data.length < 2) return <div className="small muted" style={{ padding: 12 }}>Log at least two entries to see a trend.</div>;
  const vals = data.map((d) => d.value);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const span = hi - lo || 1;
  const pts = data.map((d, i) => [(i / (data.length - 1)) * 96 + 2, 6 + (1 - (d.value - lo) / span) * (height / 2 - 16)] as const);
  return (
    <svg viewBox={`0 0 100 ${height / 2}`} preserveAspectRatio="none" width="100%" height={height} role="img" aria-label="Trend chart">
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={color} strokeWidth={1.2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={1.3} fill={color}><title>{`${data[i].label}: ${data[i].value}${unit}`}</title></circle>)}
      <text x={2} y={height / 2 - 2} fontSize={4} fill="var(--muted)" fontFamily="var(--font-mono)">{lo}{unit}</text>
      <text x={98} y={8} textAnchor="end" fontSize={4} fill="var(--muted)" fontFamily="var(--font-mono)">{hi}{unit}</text>
    </svg>
  );
}
