import { Fragment } from 'react';
import { parseMarkdown, type Inline } from '../lib/markdown';

const Inl = ({ items }: { items: Inline[] }) => (
  <>
    {items.map((i, k) => {
      switch (i.t) {
        case 'bold': return <strong key={k}>{i.v}</strong>;
        case 'italic': return <em key={k}>{i.v}</em>;
        case 'code': return <code key={k}>{i.v}</code>;
        case 'link': return <a key={k} href={i.href} target="_blank" rel="noopener noreferrer">{i.v}</a>;
        default: return <Fragment key={k}>{i.v}</Fragment>;
      }
    })}
  </>
);

/** Renders markdown as React nodes (no innerHTML). Checklists can be toggled via `onToggle(lineIndex)`. */
export function Markdown({ source, onToggle }: { source: string; onToggle?: (line: number) => void }) {
  const blocks = parseMarkdown(source);
  return (
    <div className="note-md">
      {blocks.map((b, i) => {
        switch (b.t) {
          case 'h': { const H = (`h${b.level}`) as 'h1' | 'h2' | 'h3'; return <H key={i}><Inl items={b.inl} /></H>; }
          case 'p': return <p key={i}><Inl items={b.inl} /></p>;
          case 'ul': return <ul key={i}>{b.items.map((it, k) => <li key={k}><Inl items={it} /></li>)}</ul>;
          case 'ol': return <ol key={i}>{b.items.map((it, k) => <li key={k}><Inl items={it} /></li>)}</ol>;
          case 'task': return (
            <label key={i} className="todo">
              <input type="checkbox" className="tick" style={{ width: 22, height: 22 }} checked={b.checked} onChange={() => onToggle?.(b.line)} disabled={!onToggle} />
              <span className={b.checked ? 'strike' : undefined}><Inl items={b.inl} /></span>
            </label>
          );
          case 'quote': return <blockquote key={i}><Inl items={b.inl} /></blockquote>;
          case 'code': return <pre key={i}><code>{b.v}</code></pre>;
          case 'hr': return <hr key={i} className="divider" style={{ border: 0 }} />;
        }
      })}
    </div>
  );
}
