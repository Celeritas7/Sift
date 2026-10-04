// Composer parsing rules, ported from the prototype's parseDraft.
import { TAG_TO_TOPIC } from './config';
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
