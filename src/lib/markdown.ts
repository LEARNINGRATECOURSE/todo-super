/** Tiny, safe markdown parser -> block/inline tokens (rendered as React nodes, never raw HTML). */
export type Inline = { t: 'text' | 'bold' | 'italic' | 'code' | 'link'; v: string; href?: string };
export type Block =
  | { t: 'h'; level: number; inl: Inline[] }
  | { t: 'p'; inl: Inline[] }
  | { t: 'ul'; items: Inline[][] }
  | { t: 'ol'; start: number; items: Inline[][] }
  | { t: 'task'; line: number; checked: boolean; inl: Inline[] }
  | { t: 'quote'; inl: Inline[] }
  | { t: 'code'; v: string }
  | { t: 'hr' };

export function parseInline(s: string): Inline[] {
  const out: Inline[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\((https?:\/\/[^)\s]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ t: 'text', v: s.slice(last, m.index) });
    const tok = m[0];
    if (tok.startsWith('**')) out.push({ t: 'bold', v: tok.slice(2, -2) });
    else if (tok.startsWith('`')) out.push({ t: 'code', v: tok.slice(1, -1) });
    else if (tok.startsWith('[')) out.push({ t: 'link', v: tok.slice(1, tok.indexOf(']')), href: m[2] });
    else out.push({ t: 'italic', v: tok.slice(1, -1) });
    last = m.index + tok.length;
  }
  if (last < s.length) out.push({ t: 'text', v: s.slice(last) });
  return out;
}

export function parseMarkdown(src: string): Block[] {
  const lines = src.split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]);
      i++;
      blocks.push({ t: 'code', v: buf.join('\n') });
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) { blocks.push({ t: 'h', level: h[1].length, inl: parseInline(h[2]) }); i++; continue; }
    if (/^---+$/.test(line.trim())) { blocks.push({ t: 'hr' }); i++; continue; }
    const task = /^\s*- \[( |x|X)\]\s?(.*)$/.exec(line);
    if (task) { blocks.push({ t: 'task', line: i, checked: task[1] !== ' ', inl: parseInline(task[2]) }); i++; continue; }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: Inline[][] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i]) && !/^\s*- \[( |x|X)\]/.test(lines[i])) items.push(parseInline(lines[i++].replace(/^\s*[-*]\s+/, '')));
      blocks.push({ t: 'ul', items });
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const start = parseInt(line, 10);
      const items: Inline[][] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) items.push(parseInline(lines[i++].replace(/^\s*\d+\.\s+/, '')));
      blocks.push({ t: 'ol', start, items });
      continue;
    }
    if (line.startsWith('> ')) { blocks.push({ t: 'quote', inl: parseInline(line.slice(2)) }); i++; continue; }
    if (!line.trim()) { i++; continue; }
    const para: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|```|>\s|\s*[-*]\s|\s*\d+\.\s|---+$)/.test(lines[i])) para.push(lines[i++]);
    blocks.push({ t: 'p', inl: parseInline(para.join(' ')) });
  }
  return blocks;
}

/** Toggles a `- [ ]` checkbox on a given source line. */
export function toggleTaskLine(src: string, line: number) {
  const lines = src.split('\n');
  lines[line] = lines[line].replace(/- \[( |x|X)\]/, (_, c: string) => (c === ' ' ? '- [x]' : '- [ ]'));
  return lines.join('\n');
}
