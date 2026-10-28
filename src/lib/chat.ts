// Chat view: notes as a group chat between topics. Replies and reactions come from similarity, labels and to-dos (no AI).
import { SIM_MIN } from '../similarity';
import { TOPICS } from './config';

/** Two-letter avatar tag for a topic (EN, SO, LA, RE, CA, SC). */
export const initials = (topic: string) => { const t = TOPICS.find(x => x.id === topic); if (!t) return 'SC'; return (t.custom ? Array.from(t.name.replace(/\s+/g, '')).slice(0, 2).join('') : t.tag.slice(0, 2)).toUpperCase(); };

export interface ChatNote { id: string; topic: string; title: string; sum: string; ts: number; pinned: boolean; labels: string[]; todos: { done: boolean }[]; }
export interface Reaction { emoji: string; n: number; why: string; }
export interface ChatMsg extends ChatNote { replyTo: string | null; reactions: Reaction[]; first: boolean; day: string | null; }

/** How far back (in messages) a note looks for the earlier note it answers. */
export const REPLY_WINDOW = 25;
/** Notes this close count as a strong match (🔥), looking this many notes either side (keeps big imports fast). */
export const SIM_STRONG = 0.3, STRONG_WINDOW = 200;
const RUN_GAP = 15 * 60 * 1000;

const dayKey = (ts: number) => { const d = new Date(ts); return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); };
export function dayLabel(ts: number, now = Date.now()) {
  const k = dayKey(ts); if (k === dayKey(now)) return 'Today'; if (k === dayKey(now - 864e5)) return 'Yesterday';
  const d = new Date(ts), sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}
const plural = (n: number, w: string) => n + ' ' + w + (n === 1 ? '' : 's');

/** `notes` oldest first. Returns the newest `limit` messages, each knowing what it replies to and its reactions. */
export function buildChat(notes: ChatNote[], sim: (a: string, b: string) => number, limit = 60, now = Date.now()): { msgs: ChatMsg[]; earlier: number } {
  const start = Math.max(0, notes.length - limit), shown = notes.slice(start);
  // Reply: the closest earlier note from another topic, if close enough.
  const replyTo = new Map<string, string>();
  shown.forEach((n, j) => { const i = start + j; let best: string | null = null, bestSim = SIM_MIN;
    for (let k = Math.max(0, i - REPLY_WINDOW); k < i; k++) { const o = notes[k]; if (o.topic === n.topic) continue; const s = sim(n.id, o.id); if (s >= bestSim) { best = o.id; bestSim = s; } }
    if (best) replyTo.set(n.id, best); });
  const replies = new Map<string, number>(); replyTo.forEach(to => replies.set(to, (replies.get(to) || 0) + 1));
  // Which topics use each label.
  const labelTopics = new Map<string, Set<string>>();
  notes.forEach(n => n.labels.forEach(l => { const k = l.toLowerCase(); (labelTopics.get(k) ?? labelTopics.set(k, new Set()).get(k)!).add(n.topic); }));

  let prev: ChatMsg | null = null;
  const msgs = shown.map((n, j) => { const i = start + j;
    const others = new Set<string>(); n.labels.forEach(l => labelTopics.get(l.toLowerCase())?.forEach(t => { if (t !== n.topic) others.add(t); }));
    let strong = 0; for (let k = Math.max(0, i - STRONG_WINDOW), e = Math.min(notes.length, i + STRONG_WINDOW + 1); k < e; k++) if (k !== i && sim(n.id, notes[k].id) >= SIM_STRONG) strong++;
    const done = n.todos.length > 0 && n.todos.every(t => t.done);
    const reactions: Reaction[] = [
      ...(others.size ? [{ emoji: '👍', n: others.size, why: plural(others.size, 'other topic') + ' use the same label' }] : []),
      ...(strong ? [{ emoji: '🔥', n: strong, why: plural(strong, 'closely related note') }] : []),
      ...(replies.get(n.id) ? [{ emoji: '💬', n: replies.get(n.id)!, why: plural(replies.get(n.id)!, 'reply') }] : []),
      ...(done ? [{ emoji: '✅', n: 1, why: 'All to-dos done' }] : []),
      ...(n.pinned ? [{ emoji: '📌', n: 1, why: 'Pinned' }] : []),
    ];
    const newDay = !prev || dayKey(prev.ts) !== dayKey(n.ts);
    const m: ChatMsg = { ...n, replyTo: replyTo.get(n.id) ?? null, reactions, day: newDay ? dayLabel(n.ts, now) : null,
      first: newDay || !prev || prev.topic !== n.topic || n.ts - prev.ts > RUN_GAP };
    prev = m; return m;
  });
  return { msgs, earlier: start };
}
