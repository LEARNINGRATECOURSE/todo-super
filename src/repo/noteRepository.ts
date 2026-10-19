import { db } from '../db/database';
import type { Note, NoteFolder } from '../db/types';
import { nowIso } from '../lib/dates';
import { uid } from '../lib/util';

export function saveNote(n: { id?: string; title: string; content: string; folder: NoteFolder; pinned?: boolean }): Note {
  const now = nowIso();
  const existing = n.id ? db.get('notes', n.id) : undefined;
  const note: Note = {
    id: existing?.id ?? uid('n_'), title: n.title.trim() || firstLine(n.content) || 'Untitled', content: n.content, folder: n.folder,
    pinned: (n.pinned ?? !!existing?.pinned) ? 1 : 0, createdAt: existing?.createdAt ?? now, updatedAt: now,
  };
  db.insert('notes', note);
  return note;
}
const firstLine = (s: string) => s.split('\n').find((l) => l.trim())?.replace(/^#+\s*/, '').slice(0, 60) ?? '';
export const deleteNote = (id: string) => db.remove('notes', id);
export const togglePin = (id: string) => {
  const n = db.get('notes', id);
  if (n) db.update('notes', id, { pinned: n.pinned ? 0 : 1 });
};
