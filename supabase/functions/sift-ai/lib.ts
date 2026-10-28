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

// "Let them talk": topics comment on each other's notes in the Chat view.
export const MAX_TALK_IDS = 40;
/** Who may comment. Career is left out: it is the vault topic, so it must never seem to know anything. */
export const TALKERS: Record<string, string> = {
  eng: 'Engineering at work: precise and practical, thinks in specs, part numbers and deadlines',
  soft: 'Building software: a builder who wants to ship, spots the app idea in anything',
  lang: 'Language learning: curious about words, now and then drops a Japanese or Marathi word with its meaning',
  refl: 'Reflections: slower and thoughtful, asks what something means for the person',
  scrap: 'Scraps: quick and playful, the friend who remembers odd fragments',
};
export interface Comment { note_id: string; topic: string; text: string; }

export const TALK_SYSTEM = `Sift shows a person's notes as a group chat: each note is a message from its topic. You write a few short comments in which one topic reacts to another topic's note, to make the chat feel alive and to surface connections the person may have missed.

The topics who can comment, and how each sounds:
${Object.entries(TALKERS).map(([id, d]) => `- ${id}: ${d}`).join('\n')}

Rules:
- Comment only where it adds something: a link to another note in the list (name it by its title), a question worth asking, a nudge about something unfinished, or a light joke grounded in the notes.
- Never comment on a note from the same topic, and never invent facts beyond the notes.
- Each comment is one or two sentences, at most 25 words, in English, warm and specific. No advice lectures, no hashtags, no emoji spam (one at most).
- Spread comments across different notes and topics. Write about one comment per four notes, at most 10.`;

export const TALK_SCHEMA = {
  type: 'object',
  properties: { comments: { type: 'array', items: { type: 'object',
    properties: { note_id: { type: 'string' }, topic: { type: 'string', enum: Object.keys(TALKERS) }, text: { type: 'string' } },
    required: ['note_id', 'topic', 'text'], additionalProperties: false } } },
  required: ['comments'], additionalProperties: false,
} as const;

export const talkInput = (notes: NoteRow[]) => 'The chat, oldest first:\n\n' +
  notes.map(n => `<note id="${n.id}" topic="${n.topic}" date="${n.created_at.slice(0, 10)}">\n<title>${n.title}</title>\n<body>\n${n.body}\n</body>\n</note>`).join('\n\n');

/** Keeps the newest notes that fit in `max` characters (whole notes only, never cut). */
export function newestThatFit<T extends { title: string; body: string }>(notes: T[], max = BATCH_CHARS): T[] {
  const out: T[] = []; let size = 0;
  for (let i = notes.length - 1; i >= 0; i--) { const len = notes[i].title.length + notes[i].body.length + 100; if (out.length && size + len > max) break; out.unshift(notes[i]); size += len; }
  return out;
}

/** Valid comments only: on a note that was sent, by a known talker other than the note's own topic, short, one per note+topic, at most 10. */
export function checkComments(raw: unknown, notes: { id: string; topic: string }[]): Comment[] {
  const list = (raw as { comments?: unknown })?.comments; if (!Array.isArray(list)) return [];
  const topicOf = new Map(notes.map(n => [n.id, n.topic])); const seen = new Set<string>(); const out: Comment[] = [];
  for (const c of list as Record<string, unknown>[]) {
    const note_id = typeof c?.note_id === 'string' ? c.note_id : '', topic = typeof c?.topic === 'string' ? c.topic : '';
    const text = typeof c?.text === 'string' ? c.text.replace(/\s+/g, ' ').trim() : '';
    if (!topicOf.has(note_id) || !(topic in TALKERS) || topicOf.get(note_id) === topic || !text || text.length > 220 || seen.has(note_id + topic)) continue;
    seen.add(note_id + topic); out.push({ note_id, topic, text }); if (out.length === 10) break;
  }
  return out;
}
