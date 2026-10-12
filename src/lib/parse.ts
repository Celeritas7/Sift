// Composer parsing rules, ported from the prototype's parseDraft.
import { TAG_TO_TOPIC } from './config';
import { splitSentences, tokens } from './collage';
import type { Topic } from '../types';

export const LIST_RE = /^(?:[-*•·]\s+(?:\[[ x]?\]\s*)?|\[[ x]?\]\s*|\d+[.)]\s+)/i;
export const isChecklist = (t: string) => { const ls = t.split('\n').map(l => l.trim()).filter(Boolean); const m = ls.filter(l => LIST_RE.test(l)); return m.length >= 2 && m.length >= ls.length - 1; };
export const listItems = (t: string) => t.split('\n').map(l => l.trim()).filter(l => LIST_RE.test(l)).map(l => l.replace(LIST_RE, '')).filter(Boolean);

export interface LinkCard { domain: string; path: string; }
export interface Draft { topicFromTag: Topic | null; labels: string[]; ctx: string[]; links: LinkCard[]; todos: string[]; list: boolean; detected: boolean; title: string; }

export function parseDraft(text: string, asList: boolean | null = null): Draft {
  const tags = [...text.matchAll(/(^|\s)#([\w-]+)/g)].map(m => m[2]);
  const topicFromTag = tags.map(t => TAG_TO_TOPIC[t.toLowerCase()]).find(Boolean) || null;
  const labels = [...new Set(tags.filter(t => !TAG_TO_TOPIC[t.toLowerCase()]))];
  const ctx = [...new Set([...text.matchAll(/(^|\s)(@[\w-]+)/g)].map(m => m[2]))];
  const links = [...text.matchAll(/https?:\/\/[^\s]+/g)].map(m => { try { const u = new URL(m[0]); return { domain: u.hostname.replace(/^www\./, ''), path: (u.pathname + u.search).slice(0, 48) || '/' }; } catch { return null; } }).filter((x): x is LinkCard => !!x);
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean); const detected = isChecklist(text); const list = asList ?? detected;
  const todos = list ? listItems(text) : lines.filter(l => /^(?:[-*]\s+)?\[[ x]?\]/i.test(l)).map(l => l.replace(LIST_RE, '')).filter(Boolean);
  const first = lines[0] || ''; const clean = first.replace(/(^|\s)[#@][\w-]+/g, '').trim();
  const title = !first ? 'Untitled' : LIST_RE.test(first) ? 'List · ' + todos.length + ' items' : (clean || first).slice(0, 70);
  return { topicFromTag, labels, ctx, links, todos, list, detected, title };
}

export const TEMPLATES: Record<string, () => string> = {
  meeting: () => 'Meeting — \nWith @\n\nNotes\n- \n\nActions\n- [ ] ',
  idea: () => 'Idea: \nWhy it matters: \nFirst step\n- [ ] ',
  journal: () => 'Journal · ' + new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) + '\n\n',
  list: () => 'List\n- [ ] \n- [ ] \n- [ ] ',
};
export const templateCaret = (k: string, tpl: string) => (k === 'journal' ? tpl.length : tpl.indexOf('\n'));

export type Flag = 'pin' | 'vault' | 'wf';
export const SLASH: { k: string; d: string; flag?: Flag }[] = [
  { k: '/todo', d: 'Add a checkbox line' }, { k: '/pin', d: 'Pin this note', flag: 'pin' }, { k: '/vault', d: 'Keep it in the vault', flag: 'vault' },
  { k: '/wf', d: 'Send to-dos to Weekly Focus', flag: 'wf' }, { k: '/meeting', d: 'Meeting template' }, { k: '/idea', d: 'Idea template' },
  { k: '/journal', d: 'Journal entry' }, { k: '/list', d: 'Checklist template' },
];
export const VOICE_DEMO = 'Ask Ito about the gripper ECN list before Friday';

/** Todos from an imported/stored body: checkbox lines ("- [ ]", "- [x]"). */
export const todosFromBody = (body: string) => body.split('\n').map(l => l.trim()).filter(l => /^(?:[-*]\s+)?\[[ x]?\]/i.test(l))
  .map(l => ({ text: l.replace(LIST_RE, '').trim(), done: /\[x\]/i.test(l) })).filter(t => t.text);

/** Short excerpt used where v1 has no AI summary. */
export const excerpt = (title: string, body: string, max = 220) => {
  const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
  if (title && lines[0]?.includes(title.slice(0, 20))) lines.shift(); // the title line is already shown
  return lines.map(l => l.replace(LIST_RE, '')).join(' · ').slice(0, max);
};

// ---------- Stream excerpt ----------
const BOX_LINE = /^(?:[-*]\s+)?\[[ x]?\]/i;
const URL_RE = /(?:https?:\/\/|www\.)\S+/gi;
const EXCERPT_MAX = 140;
export interface Excerpt { text: string; hits: [number, number][]; }

/** `t` cut to EXCERPT_MAX chars at a word boundary, starting near `focus` when that would otherwise be cut off.
 *  "…" marks a cut end, and a start that isn't the body's first sentence. Hits are shifted to the returned text. */
function trimExcerpt(t: string, first: boolean, hits: [number, number][]): Excerpt {
  let start = 0; const focus = hits[0];
  if (focus && focus[1] > EXCERPT_MAX) { start = t.lastIndexOf(' ', Math.max(0, focus[0] - 30)) + 1; }
  let s = t.slice(start), cut = false;
  if (s.length > EXCERPT_MAX) { const sp = s.lastIndexOf(' ', EXCERPT_MAX); s = s.slice(0, sp > EXCERPT_MAX / 2 ? sp : EXCERPT_MAX).replace(/[\s,;:–—-]+$/, ''); cut = true; }
  const pre = !first || start > 0 ? '…' : '';
  const text = pre + s + (cut ? '…' : '');
  const shifted = hits.map(([a, b]): [number, number] => [a - start + pre.length, Math.min(b - start, s.length) + pre.length]).filter(([a, b]) => a >= pre.length && b > a);
  return { text, hits: shifted };
}

/** One sentence of `body` to show under a Stream row's summary, or null.
 *  With a query: the first sentence holding every query word (else any), with the word ranges as hits; null when only the title matched.
 *  Without: the sentence richest in words that are rare across all notes (`df`: token → number of notes), skipping sentences already in
 *  `sum`, short ones (< 6 words), URLs and checklist lines. Ties go to the earlier sentence. */
export function pickExcerpt(body: string, sum: string, query: string, df?: Map<string, number>): Excerpt | null {
  const firstLine = (s: number) => body.slice(body.lastIndexOf('\n', s - 1) + 1).trimStart();
  const sents = splitSentences(body).map(sp => ({ s: sp.s, e: sp.e, t: body.slice(sp.s, sp.e).replace(/\s+/g, ' ').trim() })).filter(x => x.t);
  if (!sents.length) return null;
  const words = [...new Set(query.toLowerCase().split(/\s+/).filter(Boolean))];
  if (words.length) {
    const ranges = (t: string) => { const lo = t.toLowerCase(), out: [number, number][] = [];
      words.forEach(w => { for (let i = lo.indexOf(w); i !== -1; i = lo.indexOf(w, i + w.length)) out.push([i, i + w.length]); });
      out.sort((a, b) => a[0] - b[0] || b[1] - a[1]); const merged: [number, number][] = [];
      out.forEach(r => { const l = merged[merged.length - 1]; if (l && r[0] <= l[1]) l[1] = Math.max(l[1], r[1]); else merged.push([...r]); });
      return merged; };
    const has = (t: string) => words.filter(w => t.toLowerCase().includes(w)).length;
    const i = sents.findIndex(x => has(x.t) === words.length), k = i >= 0 ? i : sents.findIndex(x => has(x.t) > 0);
    return k < 0 ? null : trimExcerpt(sents[k].t, k === 0, ranges(sents[k].t));
  }
  const inSum = sum.replace(/\s+/g, ' ').toLowerCase();
  // URL spans in the body: the sentence splitter breaks a URL at its dots, so test overlap rather than the sentence text.
  const urls = [...body.matchAll(URL_RE)].map(m => [m.index, m.index + m[0].length]);
  const nearUrl = (x: { s: number; e: number }) => urls.some(([a, b]) => a < x.e && x.s < b);
  let best = -1, bestScore = 0;
  sents.forEach((x, i) => {
    if (x.t.split(' ').length < 6 || nearUrl(x) || BOX_LINE.test(firstLine(x.s)) || inSum.includes(x.t.toLowerCase())) return;
    const score = tokens(x.t).reduce((a, tk) => a + 1 / Math.max(1, df?.get(tk) ?? 1), 0);
    if (score > bestScore) { best = i; bestScore = score; }
  });
  return best < 0 ? null : trimExcerpt(sents[best].t, best === 0, []);
}
