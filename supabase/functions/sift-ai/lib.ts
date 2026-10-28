// Prompts, batching and output checks for the sift-ai function. No imports, so the app's tests can run it in Node.

export const MODEL = 'claude-opus-5-5';
/** Per call: at most this many notes, and batches of at most this many characters per model request. */
export const MAX_IDS = 25, MAX_DIGEST_IDS = 120, BATCH_CHARS = 60_000;

export interface NoteRow { id: string; title: string; body: string; topic: string; lang: string | null; created_at: string; }
export interface Summary { id: string; summary: string; summary_orig: string | null; }

/** Groups notes so each model request stays under BATCH_CHARS. A single longer note goes alone, whole. */
export function batches<T extends { title: string; body: string }>(notes: T[], max = BATCH_CHARS): T[][] {
  const out: T[][] = []; let cur: T[] = [], size = 0;
  for (const n of notes) {
    const len = n.title.length + n.body.length + 80;
    if (cur.length && size + len > max) { out.push(cur); cur = []; size = 0; }
    cur.push(n); size += len;
  }
  if (cur.length) out.push(cur);
  return out;
}

export const SUMMARY_SYSTEM = `You write one-line summaries for a person's private notes app. The notes are theirs: quick captures, lists, reflections, work references, often in English, Japanese or Marathi.

For each note, write:
- summary: one plain English sentence of at most 25 words that says what the note is for or about, so they recognise it at a glance in a list. Keep names, numbers and part numbers that identify it. No preamble such as "This note".
- summary_orig: when the note is mainly written in a language other than English, the same summary in that language; otherwise null.

A note that is only a title or a few words still gets a summary; restate it plainly rather than inventing detail.`;

export const SUMMARY_SCHEMA = {
  type: 'object',
  properties: { summaries: { type: 'array', items: { type: 'object',
    properties: { id: { type: 'string' }, summary: { type: 'string' }, summary_orig: { type: ['string', 'null'] } },
    required: ['id', 'summary', 'summary_orig'], additionalProperties: false } } },
  required: ['summaries'], additionalProperties: false,
} as const;

export const summaryInput = (notes: NoteRow[]) =>
  'Summarise each of these notes. Return one entry per note, with its id unchanged.\n\n' +
  notes.map(n => `<note id="${n.id}">\n<title>${n.title}</title>\n<body>\n${n.body}\n</body>\n</note>`).join('\n\n');

/** Keeps only well-formed summaries for notes that were asked about; trims and drops empty ones. */
export function checkSummaries(raw: unknown, asked: Set<string>): Summary[] {
  const list = (raw as { summaries?: unknown })?.summaries; if (!Array.isArray(list)) return [];
  const seen = new Set<string>(); const out: Summary[] = [];
  for (const s of list as Record<string, unknown>[]) {
    const id = typeof s?.id === 'string' ? s.id : ''; const summary = typeof s?.summary === 'string' ? s.summary.trim() : '';
    if (!asked.has(id) || seen.has(id) || !summary) continue; seen.add(id);
    const orig = typeof s.summary_orig === 'string' && s.summary_orig.trim() ? s.summary_orig.trim() : null;
    out.push({ id, summary, summary_orig: orig });
  }
  return out;
}

export const DIGEST_SYSTEM = `You write the weekly digest at the top of a person's private notes app: a short paragraph that tells them what their week of notes was about.

Write 2 to 4 sentences, at most 80 words, in plain English, addressed to them as "you". Name the main threads and anything that looks unfinished or worth coming back to. Be specific to the notes; no generic encouragement, no lists, no headings, no quotation of whole notes. Reply with the paragraph only.`;

export const digestInput = (weekOf: string, notes: NoteRow[]) =>
  `The week starting ${weekOf}. ${notes.length} note${notes.length === 1 ? '' : 's'}, oldest first:\n\n` +
  notes.map(n => `<note date="${n.created_at.slice(0, 10)}" topic="${n.topic}">\n<title>${n.title}</title>\n<body>\n${n.body}\n</body>\n</note>`).join('\n\n');

export const isWeekOf = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
export const isIdList = (x: unknown, max = MAX_IDS): x is string[] => Array.isArray(x) && x.length > 0 && x.length <= max && x.every(i => typeof i === 'string' && /^[0-9a-f-]{36}$/i.test(i));
