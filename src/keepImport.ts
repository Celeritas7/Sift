// Google Keep (Takeout) parser — browser side. Pair with fflate for .zip.
import type { Lang } from './types';
export const detectLang = (t: string): Lang => /[\u3040-\u30ff\u4e00-\u9fff]/.test(t) ? 'JA' : /[\u0900-\u097F]/.test(t) ? 'MR' : /[\u1000-\u109F]/.test(t) ? 'MY' : t.trim() ? 'EN' : '—';
export async function sha256(s: string) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }

export interface ParsedNote { title: string; body: string; todos: { text: string; done: boolean }[]; pinned: boolean; archived: boolean; trashed: boolean;
  labels: string[]; color?: string; created: number; edited: number; attachments: string[]; source: 'keep-json' | 'keep-html'; file: string; lang: Lang; }

export function parseKeepJson(file: string, raw: string): ParsedNote {
  const j = JSON.parse(raw); const list = (j.listContent || []) as { text: string; isChecked: boolean }[];
  const body = j.textContent || list.map(i => (i.isChecked ? '- [x] ' : '- [ ] ') + i.text).join('\n');
  return { title: j.title || '', body, todos: list.map(i => ({ text: i.text, done: !!i.isChecked })), pinned: !!j.isPinned, archived: !!j.isArchived, trashed: !!j.isTrashed,
    labels: (j.labels || []).map((l: any) => l.name), color: j.color, created: Math.round((j.createdTimestampUsec || 0) / 1000), edited: Math.round((j.userEditedTimestampUsec || 0) / 1000),
    attachments: (j.attachments || []).map((a: any) => a.filePath), source: 'keep-json', file, lang: detectLang(body) };
}
const strip = (s: string) => s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;|&#8239;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
export function parseKeepHtml(file: string, raw: string): ParsedNote {
  const doc = new DOMParser().parseFromString(raw, 'text/html');
  const q = (sel: string) => doc.querySelector(sel)?.innerHTML ?? '';
  const body = strip(q('.content')); const heading = strip(q('.heading')); const ts = Date.parse(heading) || Date.now();
  const items = [...doc.querySelectorAll('.listitem')].map(li => ({ text: strip(li.querySelector('.text')?.innerHTML ?? ''), done: li.classList.contains('checked') }));
  return { title: strip(q('.title')), body: items.length ? items.map(i => (i.done ? '- [x] ' : '- [ ] ') + i.text).join('\n') : body, todos: items, pinned: false, archived: !!doc.querySelector('.archived'), trashed: false,
    labels: [...doc.querySelectorAll('.label-name')].map(e => strip(e.innerHTML)), created: ts, edited: ts,
    attachments: [...doc.querySelectorAll('img')].map(i => i.getAttribute('src') || '').filter(s => s && !s.startsWith('data:')), source: 'keep-html', file, lang: detectLang(body) };
}
// Idempotency: content_hash = sha256(title + '\n' + body); skip if (user_id, file, hash) already in sift_import_files or hash exists in sift_notes.
// Topic assignment at import: user labels → labels[]; topic = nearest existing note's topic by trigram sim (>= 0.15) else 'scrap'; user can change later.
// Vault at import: notes whose body matches the user's private patterns (configurable) → vault = true.
