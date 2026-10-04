import { useEffect, useMemo, useState } from 'react';
import { useStore } from './store';
import { TrigramIndex, SIM_DUPLICATE } from '../similarity';
import { DARK, LIGHT } from '../lib/config';
import { excerpt } from '../lib/parse';
import type { Note, Todo, Topic } from '../types';

export interface NoteV extends Note { ts: number; hidden: boolean; todoList: Todo[]; sum: string; }

export const noteText = (n: Pick<Note, 'title' | 'body' | 'labels'>) => n.title + ' ' + n.body + ' ' + (n.labels || []).join(' ');

/** All live notes with vault visibility applied. "open" = what search, Map, related, to-dos and Lens may show. */
export function useNotes() {
  const notes = useStore(s => s.notes), todos = useStore(s => s.todos), unlocked = useStore(s => s.unlocked);
  return useMemo(() => {
    const byNote: Record<string, Todo[]> = {};
    Object.values(todos).forEach(t => { (byNote[t.note_id] ||= []).push(t); });
    const all: NoteV[] = Object.values(notes).filter(n => !n.deleted_at).map(n => ({
      ...n, ts: Date.parse(n.created_at), hidden: n.vault && !unlocked, todoList: (byNote[n.id] || []).sort((a, b) => a.ord - b.ord),
      sum: n.summary || excerpt(n.title, n.body),
    })).sort((a, b) => b.ts - a.ts);
    const active = all.filter(n => !n.archived), open = active.filter(n => !n.hidden);
    return { all, active, open, lockedCount: active.filter(n => n.hidden).length, byId: Object.fromEntries(all.map(n => [n.id, n])) as Record<string, NoteV> };
  }, [notes, todos, unlocked]);
}

/** Trigram TF-IDF index over every note (rebuilt only when text changes). */
export function useIndex() {
  const notes = useStore(s => s.notes);
  const list = Object.values(notes).filter(n => !n.deleted_at);
  const key = list.map(n => n.id + ':' + n.title.length + ':' + n.body.length + ':' + n.labels.length).join('|');
  return useMemo(() => new TrigramIndex(list.map(n => ({ id: n.id, text: noteText(n) }))), [key]);
}

/** Topic + related notes for a draft, from the open notes. */
export function suggestFor(index: TrigramIndex, open: NoteV[], text: string): { topic: Topic | null; related: { n: NoteV; sim: number }[] } {
  if (text.trim().length < 6) return { topic: null, related: [] };
  const vec = index.vecOf(text);
  const scored = open.map(n => ({ n, sim: index.simVec(vec, n.id) })).sort((a, b) => b.sim - a.sim);
  return { topic: scored[0] && scored[0].sim > 0.06 ? scored[0].n.topic : null, related: scored.filter(x => x.sim > 0.06).slice(0, 3) };
}

/** Near-duplicate pairs (trigram cosine >= 0.9) among visible notes, minus pairs the user kept. */
export function useConflicts() {
  const { open, byId } = useNotes(); const index = useIndex(); const dismissed = useStore(s => s.dismissed);
  const ids = open.map(n => n.id).join('|');
  const pairs = useMemo(() => index.nearDuplicates(open.map(n => n.id), SIM_DUPLICATE), [index, ids]);
  return useMemo(() => pairs.filter(p => !dismissed[p.a + '|' + p.b] && byId[p.a] && byId[p.b]).map(p => ({ ...p, A: byId[p.a], B: byId[p.b] })), [pairs, dismissed, byId]);
}

export function usePalette() {
  const theme = useStore(s => s.settings.theme); const dark = theme === 'dark';
  return { dark, c: dark ? DARK : LIGHT };
}

export function useIsMobile() {
  const q = '(max-width: 430px)';
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => { const mq = window.matchMedia(q); const f = () => setM(mq.matches); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f); }, []);
  return m;
}

/** Re-render every `ms` (for "Ns ago" labels). */
export function useTick(ms = 1000) {
  const [, set] = useState(0);
  useEffect(() => { const t = setInterval(() => set(x => x + 1), ms); return () => clearInterval(t); }, [ms]);
}

/** Notes for Ambient + Resurface: not yet opened first, then oldest. */
export function useAmbientPool() {
  const { open } = useNotes(); const opened = useStore(s => s.opened);
  return useMemo(() => open.filter(n => n.body.length > 12).sort((a, b) => ((opened[a.id] ? 1 : 0) - (opened[b.id] ? 1 : 0)) || (a.ts - b.ts)), [open, opened]);
}
