// Weekly Focus bridge: same Supabase project, table weekly_focus_entries(board_id, item_key, payload jsonb).
import type { Topic, WfBoardMeta, WfEntry, WfItemPayload, WfMutation, WfSubtask } from '../types';
import { TOPIC_PREFIX, modeForTopic } from '../types';
import { shortId } from './format';

export const isItem = (e: WfEntry): e is WfEntry & { payload: WfItemPayload } => e.item_key !== '__board' && Array.isArray((e.payload as WfItemPayload).subtasks);
export const boardMeta = (entries: WfEntry[]): Partial<WfBoardMeta> => {
  const b = entries.find(e => e.item_key === '__board'); return (b?.payload as { meta?: WfBoardMeta } | undefined)?.meta ?? {};
};
export const items = (entries: WfEntry[]) => entries.filter(isItem).sort((a, b) => (a.payload.ord ?? 0) - (b.payload.ord ?? 0));
export const activeItems = (entries: WfEntry[]) => items(entries).filter(i => i.payload.active);

/** Apply one mutation to an item payload; every touched subtask gets u = now (ms), which is how Weekly Focus resolves edits. */
export function applyWfMutation(p: WfItemPayload, mut: WfMutation): WfItemPayload {
  const now = Date.now(); const subs = p.subtasks || [];
  if (mut.type === 'set_done') return { ...p, subtasks: subs.map(s => (s.id === mut.id ? { ...s, done: mut.done, u: now } : s)) };
  if (mut.type === 'add') return { ...p, subtasks: [...subs, ...mut.subtasks.map(s => ({ ...s, u: now }))] };
  // Weekly Focus deletes by tombstone (del: true), so its own merge never brings the task back.
  if (mut.type === 'delete') return { ...p, subtasks: subs.map(s => (s.id === mut.id ? { ...s, del: true, u: now } : s)) };
  return { ...p, subtasks: subs.filter(s => !(s.src || '').startsWith(mut.prefix)) };
}

/** Sift→WF rule: Engineering → office:*, Software → app:*, Language → study:*; else first active item. */
export function suggestItem(entries: WfEntry[], topic: Topic): string | null {
  const act = activeItems(entries); const pre = TOPIC_PREFIX[topic];
  const hit = pre && act.find(i => i.item_key.startsWith(pre));
  return (hit || act[0])?.item_key ?? null;
}

export const newSubtask = (t: string, topic: Topic, ctx: string[], src: string): WfSubtask => ({
  id: shortId(), t, done: false, u: Date.now(), del: false, when: '', md: modeForTopic(topic), urg: false, dl: false, loc: '', tag: '', ctx, lat: false, latAt: 0, rv: '', src,
});

export const ctxFromWf = (entries: WfEntry[]) => [...new Set(items(entries).flatMap(i => i.payload.subtasks.flatMap(s => s.ctx || [])))];
