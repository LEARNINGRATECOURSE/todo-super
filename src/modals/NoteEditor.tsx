import { Eye, List, ListChecks, Pencil, Pin, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Markdown } from '../components/Markdown';
import { Button, Confirm, IconButton, Pills, Sheet, TextArea, TextInput } from '../components/ui';
import type { NoteFolder } from '../db/types';
import { toggleTaskLine } from '../lib/markdown';
import { deleteNote, saveNote } from '../repo/noteRepository';
import { useAppStore } from '../store/useAppStore';
import { useUIStore } from '../store/useUIStore';

export const NOTE_FOLDERS: NoteFolder[] = ['Personal', 'Work', 'Ideas', 'Journal'];

export function NoteEditor({ id }: { id?: string }) {
  const close = useUIStore((s) => s.close);
  const toast = useUIStore((s) => s.toast);
  const existing = useAppStore((s) => s.notes).find((n) => n.id === id);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [content, setContent] = useState(existing?.content ?? '');
  const [folder, setFolder] = useState<NoteFolder>(existing?.folder ?? 'Personal');
  const [pinned, setPinned] = useState(!!existing?.pinned);
  const [preview, setPreview] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);

  /** Inserts a markdown prefix at the start of the current line. */
  const insert = (prefix: string) => {
    const el = ta.current;
    const pos = el?.selectionStart ?? content.length;
    const lineStart = content.lastIndexOf('\n', pos - 1) + 1;
    const needsNl = pos > lineStart ? '\n' : '';
    const at = pos > lineStart ? pos : lineStart;
    const next = content.slice(0, at) + needsNl + prefix + content.slice(at);
    setContent(next);
    requestAnimationFrame(() => { el?.focus(); const p = at + needsNl.length + prefix.length; el?.setSelectionRange(p, p); });
  };
  const dirty = (existing?.title ?? '') !== title || (existing?.content ?? '') !== content;
  const save = () => {
    if (!title.trim() && !content.trim()) { toast('Note is empty', { tone: 'warn' }); return; }
    saveNote({ id: existing?.id, title, content, folder, pinned });
    toast('Note saved', { tone: 'success' });
    close('note');
  };
  const tryClose = () => { if (dirty && (title.trim() || content.trim())) saveNote({ id: existing?.id, title, content, folder, pinned }); close('note'); };

  return (
    <Sheet full title={existing ? 'Edit note' : 'New note'} onClose={tryClose}
      headerRight={<IconButton sm label={pinned ? 'Unpin' : 'Pin'} on={pinned} onClick={() => setPinned((p) => !p)}><Pin size={16} /></IconButton>}
      footer={<>
        {existing && <Button aria-label="Delete note" onClick={() => setConfirm(true)}><Trash2 size={16} /></Button>}
        <Button block variant="primary" onClick={save}>Save</Button>
      </>}>
      <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" aria-label="Title" style={{ fontWeight: 700 }} />
      <Pills options={NOTE_FOLDERS} value={folder} onChange={setFolder} />
      <div className="row">
        <IconButton sm label="Insert checklist item" onClick={() => insert('- [ ] ')}><ListChecks size={18} /></IconButton>
        <IconButton sm label="Insert bullet" onClick={() => insert('- ')}><List size={18} /></IconButton>
        <Button sm onClick={() => insert('## ')}>H2</Button>
        <Button sm onClick={() => insert('> ')}>Quote</Button>
        <div className="grow" />
        <IconButton sm label={preview ? 'Edit' : 'Preview'} on={preview} onClick={() => setPreview((p) => !p)}>{preview ? <Pencil size={16} /> : <Eye size={16} />}</IconButton>
      </div>
      {preview ? (
        <div className="card recessed" style={{ minHeight: 240 }}><Markdown source={content || '*Nothing to preview*'} onToggle={(line) => setContent((c) => toggleTaskLine(c, line))} /></div>
      ) : (
        <TextArea ref={ta} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write in markdown…" style={{ minHeight: 280 }} aria-label="Note content" />
      )}
      {confirm && existing && <Confirm title="Delete note?" text="This cannot be undone." onConfirm={() => { deleteNote(existing.id); close('note'); }} onClose={() => setConfirm(false)} />}
    </Sheet>
  );
}
