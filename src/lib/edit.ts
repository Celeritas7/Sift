// Editing a note in the sheet: normalise the text, re-parse its checklist into sift_todos, refresh links, undo.
import { useStore } from '../state/store';
import { detectLang } from '../keepImport';
import { LIST_RE } from './parse';
import { nowIso, uid } from './format';
import type { Note, Todo } from '../types';

const BOX_RE = /^(?:[-*]\s+)?\[[ x]?\]/i;

/** Trailing whitespace trimmed (per line and at the end); an empty title becomes "Untitled". */
export const normalizeEdit = (title: string, body: string) => ({
  title: title.trim() || 'Untitled',
  body: body.split('\n').map(l => l.trimEnd()).join('\n').trimEnd(),
});

/** The note's to-dos after its body changed. Existing to-dos are matched by text (keeping id, done and the WF link);
 *  new checkbox lines become new to-dos; unmatched to-dos are dropped unless they are linked to Weekly Focus.
 *  Plain list lines ("- item") only keep an existing to-do alive, as notes captured as a list store those. */
export function reconcileTodos(existing: Todo[], body: string, note: Pick<Note, 'id' | 'user_id'>, now = nowIso()): Todo[] {
  const pool = [...existing].sort((a, b) => a.ord - b.ord); const used = new Set<string>(); const out: Todo[] = []; let ord = 0;
  for (const raw of body.split('\n')) {
    const l = raw.trim(); const box = BOX_RE.test(l); if (!box && !LIST_RE.test(l)) continue;
    const text = l.replace(LIST_RE, '').trim(); if (!text) continue;
    const hit = pool.find(t => !used.has(t.id) && t.text.trim() === text);
    if (hit) { used.add(hit.id); out.push({ ...hit, ord: ord++ }); }
    else if (box) out.push({ id: uid(), user_id: note.user_id, note_id: note.id, ord: ord++, text, done: /\[x\]/i.test(l), wf_board_id: null, wf_item_key: null, wf_subtask_id: null, updated_at: now });
  }
  pool.forEach(t => { if (!used.has(t.id) && t.wf_item_key) out.push(t); });
  return out;
}

let linksTimer: ReturnType<typeof setTimeout> | undefined;
/** Recompute note links (Map, Conflicts) once edits settle. */
export const refreshLinksSoon = (ms = 1500) => { clearTimeout(linksTimer); linksTimer = setTimeout(() => void useStore.getState().refreshLinks().catch(() => {}), ms); };

/** Save new title/body. content_hash, source and source_file stay as they are, so a re-import still skips a Keep note.
 *  Returns an undo that restores the previous text and to-dos, or null when nothing changed. */
export async function saveNoteEdit(id: string, title: string, body: string): Promise<{ undo: () => Promise<void> } | null> {
  const st = useStore.getState(); const n = st.notes[id]; if (!n) return null;
  const next = normalizeEdit(title, body); if (next.title === n.title && next.body === n.body) return null;
  const prev: Partial<Note> = { title: n.title, body: n.body, edited_at: n.edited_at, lang: n.lang };
  const prevTodos = Object.values(st.todos).filter(t => t.note_id === id);
  await st.updateNote(id, { ...next, edited_at: nowIso(), lang: detectLang(next.title + '\n' + next.body) }); // re-anchors highlights when the body changed
  if (next.body !== n.body) await st.replaceTodos(id, reconcileTodos(prevTodos, next.body, n));
  refreshLinksSoon();
  return { undo: async () => { const s = useStore.getState(); await s.updateNote(id, prev); await s.replaceTodos(id, prevTodos); refreshLinksSoon(); } };
}
