import { forwardRef, isValidElement, useEffect, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import * as L from 'lucide-react';
import { X, Plus, Minus } from 'lucide-react';
import { cx } from '../lib/util';

/* ----- icons by name (used for stored achievement/challenge icons) ----- */
const ICONS: Record<string, L.LucideIcon> = {
  Dumbbell: L.Dumbbell, Flame: L.Flame, Trophy: L.Trophy, Medal: L.Medal, Weight: L.Weight, CalendarCheck: L.CalendarCheck,
  Zap: L.Zap, Star: L.Star, Timer: L.Timer, Link: L.Link, Sun: L.Sun,
};
export const NamedIcon = ({ name, size = 22 }: { name: string; size?: number }) => {
  const I = ICONS[name] ?? L.Star;
  return <I size={size} strokeWidth={1.75} />;
};

/* ----- Card ----- */
interface CardProps { children: ReactNode; className?: string; screws?: boolean; vents?: boolean; elevated?: boolean; dark?: boolean; recessed?: boolean; onClick?: () => void; style?: CSSProperties; lift?: boolean }
export function Card({ children, className, screws, vents, elevated, dark, recessed, onClick, style, lift }: CardProps) {
  const interactive = !!onClick;
  return (
    <div
      className={cx('card', screws && 'screws', elevated && 'elevated', dark && 'dark carbon', recessed && 'recessed', interactive && 'press', lift && 'lift', className)}
      onClick={onClick}
      style={style}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick?.()) : undefined}
    >
      {vents && <div className="vents" aria-hidden><i /><i /><i /></div>}
      {children}
    </div>
  );
}

/* ----- Buttons ----- */
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; sm?: boolean; block?: boolean; on?: boolean }
export function Button({ variant = 'secondary', sm, block, on, className, ...rest }: BtnProps) {
  return <button type="button" className={cx('btn', variant !== 'secondary' && variant, sm && 'sm', block && 'block', on && 'on', className)} {...rest} />;
}
export function IconButton({ label, sm, on, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; sm?: boolean; on?: boolean }) {
  return <button type="button" aria-label={label} title={label} className={cx('iconbtn', sm && 'sm', on && 'on', className)} {...rest}>{children}</button>;
}
export const Housing = ({ children, sm, color }: { children: ReactNode; sm?: boolean; color?: string }) => (
  <span className={cx('housing', sm && 'sm')} style={color ? { color } : undefined}>{children}</span>
);

export const Led = ({ color = 'on', pulse }: { color?: 'on' | 'red' | 'amber' | 'off'; pulse?: boolean }) => (
  <span className={cx('led', color !== 'off' && color, pulse && 'pulse')} aria-hidden />
);
export const Label = ({ children, className }: { children: ReactNode; className?: string }) => <span className={cx('label', className)}>{children}</span>;
export const Tag = ({ children, tone }: { children: ReactNode; tone?: 'hot' | 'ok' }) => <span className={cx('tag', tone)}>{children}</span>;

/* ----- Form fields ----- */
/** A <label> forwards clicks to its first control, so only single-input fields use one; button groups get a labelled group. */
const isSingleControl = (c: ReactNode) =>
  isValidElement(c) && (typeof c.type === 'string' ? ['input', 'select', 'textarea'].includes(c.type) : [TextInput, TextArea, Select, NumInput].includes(c.type as never));

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  const body = (
    <>
      <Label>{label}</Label>
      {children}
      {hint && <span className="tiny muted" style={{ paddingLeft: 4 }}>{hint}</span>}
    </>
  );
  return isSingleControl(children)
    ? <label className="field">{body}</label>
    : <div className="field" role="group" aria-label={label}>{body}</div>;
}
export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => <input ref={ref} className={cx('input', className)} {...p} />);
export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => <textarea ref={ref} className={cx('textarea', className)} {...p} />);
export const Select = ({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => <select className={cx('select', className)} {...p} />;

/** Numeric text input that tolerates partial entries like "62." while typing. */
export function NumInput({ value, onChange, className, compact = true, placeholder, label, max, min = 0 }: { value: number | null; onChange: (n: number) => void; className?: string; compact?: boolean; placeholder?: string; label?: string; max?: number; min?: number }) {
  const [txt, setTxt] = useState(value == null ? '' : String(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setTxt(value == null ? '' : String(value)); }, [value]);
  return (
    <input
      className={cx('input', compact && 'compact', className)} inputMode="decimal" value={txt} placeholder={placeholder} aria-label={label}
      onFocus={(e) => { focused.current = true; e.target.select(); }}
      onBlur={() => { focused.current = false; setTxt(value == null ? '' : String(value)); }}
      onChange={(e) => {
        const v = e.target.value.replace(',', '.');
        if (!/^\d*\.?\d*$/.test(v)) return;
        setTxt(v);
        const n = parseFloat(v);
        if (!Number.isNaN(n)) onChange(Math.min(max ?? Infinity, Math.max(min, n)));
        else if (v === '') onChange(0);
      }}
    />
  );
}

export function NumberStepper({ value, onChange, step = 1, min = 0, max = 9999, unit, width }: { value: number; onChange: (n: number) => void; step?: number; min?: number; max?: number; unit?: string; width?: number }) {
  const clampV = (n: number) => Math.min(max, Math.max(min, Math.round(n * 100) / 100));
  return (
    <div className="stepper">
      <IconButton sm label="Decrease" onClick={() => onChange(clampV(value - step))}><Minus size={18} /></IconButton>
      <div style={{ width: width ?? 80 }}><NumInput value={value} onChange={(n) => onChange(clampV(n))} label="Value" min={min} max={max} /></div>
      <IconButton sm label="Increase" onClick={() => onChange(clampV(value + step))}><Plus size={18} /></IconButton>
      {unit && <span className="label">{unit}</span>}
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="group">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}
export function Pills<T extends string>({ options, value, onChange }: { options: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="pills hide-scroll" role="group">
      {options.map((o) => <button key={o} type="button" className="pill" aria-pressed={value === o} onClick={() => onChange(o)}>{o}</button>)}
    </div>
  );
}

/* ----- Progress ring ----- */
export function Ring({ value, size = 64, stroke = 8, color = 'var(--accent)', track = 'var(--recessed)', children }: { value: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.min(1, Math.max(0, value));
  return (
    <div style={{ width: size, height: size, position: 'relative', flex: 'none' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: 'stroke-dashoffset 0.5s var(--ease)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>{children}</div>
    </div>
  );
}

export const Progress = ({ value, tone }: { value: number; tone?: 'ok' }) => (
  <div className={cx('bar', tone)} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} /></div>
);

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon && <Housing>{icon}</Housing>}
      <strong style={{ color: 'var(--text)' }}>{title}</strong>
      {text && <span className="small" style={{ maxWidth: 280 }}>{text}</span>}
      {action}
    </div>
  );
}

/* ----- Modal sheet ----- */
let scrollLocks = 0;
export function Sheet({ title, onClose, children, footer, full, z = 60, headerRight }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; full?: boolean; z?: number; headerRight?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollLocks++;
    document.body.style.overflow = 'hidden';
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (--scrollLocks === 0) document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [onClose]);
  return createPortal(
    <div className="sheet-wrap" style={{ zIndex: z }}>
      <div className="backdrop" onClick={onClose} />
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} className={cx('sheet', 'screws', full && 'full')} style={{ outline: 'none' }}>
        <div className="grip" />
        <div className="sheet-head">
          <h2>{title}</h2>
          {headerRight}
          <IconButton sm label="Close" onClick={onClose}><X size={20} /></IconButton>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      style={{ width: 62, height: 34, borderRadius: 9999, background: 'var(--chassis)', boxShadow: 'var(--shadow-recessed)', position: 'relative', flex: 'none' }}
    >
      <span style={{ position: 'absolute', top: 4, left: checked ? 32 : 4, width: 26, height: 26, borderRadius: 9999, background: checked ? 'var(--accent)' : 'var(--chassis)', boxShadow: 'var(--shadow-card-sm)', transition: 'all .25s var(--ease)' }} />
    </button>
  );
}

export function Confirm({ title, text, confirmLabel = 'Delete', onConfirm, onClose }: { title: string; text: string; confirmLabel?: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <Sheet title={title} onClose={onClose} z={80} footer={<><Button block onClick={onClose}>Cancel</Button><Button block variant="primary" onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Button></>}>
      <p>{text}</p>
    </Sheet>
  );
}
