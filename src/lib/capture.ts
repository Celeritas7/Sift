// Turn composer / map text into a note, following the prototype's saveNote rules.
import { useStore } from '../state/store';
import { suggestFor, type NoteV } from '../state/derived';
import type { TrigramIndex } from '../similarity';
import { parseDraft, type Flag } from './parse';
import { suggestItem } from './wf';
import { detectLang } from '../keepImport';
import { cloud } from './supabase';
import { uid } from './format';
import type { Topic } from '../types';

export interface CaptureOpts { topic?: Topic | null; asList?: boolean | null; flags?: Partial<Record<Flag, boolean>>; img?: string | null; }

export async function captureNote(text: string, o: CaptureOpts, index: TrigramIndex, open: NoteV[]) {
  const t = text.trim(); if (!t) return null;
  const st = useStore.getState(); const pd = parseDraft(t, o.asList ?? null); const sug = suggestFor(index, open, t); const f = o.flags || {};
  const topic: Topic = o.topic || pd.topicFromTag || sug.topic || 'scrap';
  const wfItem = f.wf && pd.todos.length ? suggestItem(Object.values(st.wf), topic) : null;
  const id = uid();
  const ext = o.img?.match(/^data:image\/(\w+)/)?.[1]?.replace('jpeg', 'jpg') || 'png';
  const image = o.img ? { path: cloud ? `${st.userId}/sift/${id}.${ext}` : `local/${id}.${ext}`, dataUrl: o.img } : null;
  const [note] = await st.addNotes([{ id, title: pd.title, body: t, topic, labels: pd.labels, ctx: pd.ctx, pinned: !!f.pin, vault: !!f.vault, lang: detectLang(t),
    todos: pd.todos.map(x => ({ text: x, done: false })), source: 'sift', source_file: null, image, wfItem }]);
  return { note, wfItem, todos: pd.todos.length };
}
