// Collage mode: client-side matching of the user's writing against notes (no AI), plus the card looks.
import type { CollageMark, CollageSettings, HighlightColor, Note, Topic } from '../types';
import type { Anchored } from './highlights';
import type { Palette } from './config';

export const DEFAULT_COLLAGE: CollageSettings = { pad: '', marks: [], muted: [], noteBg: 'paper', tilt: true, concept: 'sticky', view: 'board', filter: 'hide', seed: 0 };

// ---------- colours ----------
export const STICKY: Record<string, string> = { eng: '#8FD3EE', soft: '#F7A8C8', lang: '#BDE58A', refl: '#F9B872', career: '#C9B6F2', scrap: '#E6DED0' };
export const NOTE_BGS: { id: CollageSettings['noteBg']; label: string; bg?: string; dark?: boolean }[] = [
  { id: 'paper', label: 'Paper (follows theme)' }, { id: 'white', label: 'White', bg: '#FFFFFF' }, { id: 'kraft', label: 'Kraft', bg: '#E6D7BC' },
  { id: 'fog', label: 'Fog', bg: '#E2E6EA' }, { id: 'ink', label: 'Ink', bg: '#25211E', dark: true },
];
export const MK = [{ h: 25, label: 'Red' }, { h: 250, label: 'Blue' }, { h: 150, label: 'Green' }, { h: 310, label: 'Violet' }];
const HL = [95, 300, 160, 30, 230, 345, 125, 265];
const YELLOW = '#FFE53B', YELLOW_DARK = '#F2D22E';
const INK_L = '#221E1A', MU_L = 'rgba(34,30,26,.62)', INK_D = '#EFE8DC', MU_D = 'rgba(239,232,220,.6)';

export const mkBg = (ci: number, dark: boolean) => `oklch(${dark ? 0.56 : 0.8} 0.15 ${MK[ci % MK.length].h})`;
export const mkLine = (ci: number) => `oklch(0.52 0.19 ${MK[ci % MK.length].h})`;
const hlCol = (pi: number, dark: boolean) => `oklch(${dark ? 0.48 : 0.88} ${dark ? 0.11 : 0.14} ${HL[pi % HL.length]})`;
/** Highlight colour of paragraph `pi`: yellow for sticky notes, a per-paragraph hue for highlighters. */
export const hl = (pi: number, concept: CollageSettings['concept'], dark: boolean) => (concept === 'sticky' ? (dark ? YELLOW_DARK : YELLOW) : hlCol(pi, dark));
export const marker = (col: string) => `linear-gradient(180deg, transparent 10%, ${col} 10%, ${col} 90%, transparent 90%)`;

export interface Look { bg: string; ink: string; mu: string; line: string; dark: boolean; border: string; radius: number; tape: string | null; tapeRot: number; shadow: string; }
export function look(id: string, topic: Topic, cfg: Pick<CollageSettings, 'concept' | 'noteBg'>, c: Palette, pageDark: boolean): Look {
  if (cfg.concept === 'sticky') return { bg: STICKY[topic] || STICKY.scrap, ink: INK_L, mu: MU_L, line: 'rgba(34,30,26,.15)', dark: false, border: 'transparent', radius: 2, tape: null, tapeRot: 0,
    shadow: '0 1px 1px rgba(0,0,0,.08),0 10px 18px -6px rgba(0,0,0,.24)' };
  const o = NOTE_BGS.find(x => x.id === cfg.noteBg) || NOTE_BGS[0]; const dark = o.id === 'paper' ? pageDark : !!o.dark;
  return { bg: o.id === 'paper' ? c.sf : o.bg!, ink: dark ? INK_D : INK_L, mu: dark ? MU_D : MU_L, line: dark ? 'rgba(239,232,220,.14)' : 'rgba(34,30,26,.12)', dark,
    border: dark ? 'rgba(239,232,220,.1)' : 'rgba(34,30,26,.1)', radius: 4, tape: dark ? 'rgba(239,232,220,.18)' : 'rgba(34,30,26,.1)',
    tapeRot: ((hash(id) >> 3) % 9) - 4, shadow: '0 1px 0 rgba(0,0,0,.04),0 8px 22px rgba(0,0,0,.1)' };
}

export const hash = (s: string) => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };
export const rnd = (seed: number) => { const x = Math.sin(seed) * 10000; return x - Math.floor(x); };

// ---------- tokens ----------
const STOP = new Set('the and for that this with was were are but not you your from have has had they them then than there what when where which who will would can could should into just about over also only very more most some such been being its our out all any one each how why now ago did does done get got his her him she ours mine myself itself because while still even much many like make made really thing things wasnt dont didnt isnt its im ive used use once well kind lot need time per let'.split(' '));

export function stem(w: string) {
  if (/[^\x00-\x7f]/.test(w)) return w;
  w = w.replace(/['’]s$/, '').replace(/['’]/g, '');
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith('ies')) w = w.slice(0, -3) + 'y';
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  if (w.length > 4 && w.endsWith('e')) w = w.slice(0, -1);
  return w;
}
export function tokens(str: string) {
  const out = new Set<string>();
  for (let w of str.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}\p{M}'’-]*/gu) || []) {
    w = w.replace(/['’-]+$/, '');
    if (w.length < 3 || STOP.has(w.replace(/['’]/g, '')) || /^\d+$/.test(w)) continue;
    out.add(stem(w));
  }
  return [...out];
}
const same = (a: string, b: string) => a === b || (a.length >= 6 && b.length >= 6 && a.slice(0, 6) === b.slice(0, 6));

// ---------- sentences, paragraphs, marks ----------
export interface Span { s: number; e: number; }
/** Lossless split: every character of `text` lands in exactly one span. */
export function splitSentences(text: string): Span[] {
  const out: Span[] = [], re = /[^.!?。！？।\n]*[.!?。！？।]+|[^.!?。！？।\n]+|\n+/g; let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push({ s: m.index, e: m.index + m[0].length });
  return out;
}

export interface Para { i: number; t: string; tk: string[]; muted: boolean; }
export const paragraphs = (pad: string, muted: number[]): Para[] =>
  pad.split(/\n+/).map(t => t.trim()).filter(t => tokens(t).length >= 2).map((t, i) => ({ i, t, tk: tokens(t), muted: muted.includes(i) }));

export interface MarkHit extends Span { mi: number; }
const isW = (ch: string | undefined) => !!ch && /[\p{L}\p{M}\p{N}]/u.test(ch);
/** Case-insensitive mark hits. Single ASCII words match by stem from a word start to the word end; others match exactly. Overlaps: earliest, longest wins. */
export function findMarks(text: string, marks: CollageMark[]): MarkHit[] {
  const lo = text.toLowerCase(), out: MarkHit[] = [];
  marks.forEach((m, mi) => {
    const k = m.t.toLowerCase().trim(), word = !/[^\x00-\x7f]/.test(k) && !/\s/.test(k);
    const key = word ? stem(k) : k; if (key.length < 2) return;
    let i = 0;
    while ((i = lo.indexOf(key, i)) !== -1) {
      const s = i; let e = i + key.length;
      if (word && isW(lo[s - 1])) { i = e; continue; }
      if (word) while (e < lo.length && isW(lo[e])) e++;
      out.push({ s, e, mi }); i = e;
    }
  });
  out.sort((a, b) => a.s - b.s || b.e - a.e);
  const clean: MarkHit[] = []; let end = -1;
  for (const r of out) if (r.s >= end) { clean.push(r); end = r.e; }
  return clean;
}

// ---------- matching ----------
export interface Sentence extends Span { raw: string; pi: number | null; sc: number; }
export interface NoteMatch { sents: Sentence[]; hits: Sentence[]; mrs: MarkHit[]; mset: number[]; pis: number[]; score: number; }

function analyse(text: string, paras: Para[]): Sentence[] {
  return splitSentences(text).map(se => {
    const raw = text.slice(se.s, se.e), tk = tokens(raw); let best: number | null = null, bs = 0;
    if (tk.length) paras.forEach(p => { if (p.muted) return; const sc = p.tk.filter(a => tk.some(b => same(a, b))).length; if (sc > bs) { bs = sc; best = p.i; } });
    const hit = best != null && (bs >= 2 || (bs === 1 && tk.length <= 3));
    return { ...se, raw, pi: hit ? best : null, sc: hit ? bs : 0 };
  });
}
export function matchText(text: string, paras: Para[], marks: CollageMark[]): NoteMatch {
  const sents = analyse(text, paras), hits = sents.filter(x => x.pi != null), mrs = findMarks(text, marks);
  return { sents, hits, mrs, mset: [...new Set(mrs.map(m => m.mi))], pis: [...new Set(hits.map(x => x.pi!))].sort((a, b) => a - b),
    score: hits.reduce((a, x) => a + x.sc, 0) + mrs.length * 3 };
}

/** Per-note memo: a note is re-matched only when its text, the paragraphs or the marks change. */
const memo = new Map<string, { key: string; m: NoteMatch }>();
export function matchNote(n: Pick<Note, 'id' | 'body' | 'updated_at'>, paras: Para[], marks: CollageMark[], inputKey: string): NoteMatch {
  const key = n.updated_at + '|' + n.body.length + '|' + inputKey, hit = memo.get(n.id);
  if (hit && hit.key === key) return hit.m;
  const m = matchText(n.body, paras, marks); memo.set(n.id, { key, m }); return m;
}
export const inputKey = (paras: Para[], marks: CollageMark[]) => JSON.stringify([paras.map(p => (p.muted ? '-' : '') + p.tk.join(' ')), marks.map(m => m.t.toLowerCase())]);

export const isLive = (paras: Para[], marks: CollageMark[]) => paras.some(p => !p.muted) || marks.length > 0;
export const passes = (m: NoteMatch, live: boolean) => !live || m.hits.length > 0 || m.mrs.length > 0;

export function hitLine(m: NoteMatch, marks: CollageMark[]) {
  const parts: string[] = [];
  if (m.hits.length) parts.push(m.hits.length + ' sentence' + (m.hits.length === 1 ? '' : 's') + ' · paragraph ' + m.pis.map(i => i + 1).join(', '));
  if (m.mset.length) parts.push(m.mset.map(i => '“' + marks[i].t + '”').join(', '));
  return parts.join(' · ');
}

// ---------- highlight segments ----------
export type Seg = { t: string; kind: 'plain' } | { t: string; kind: 'hl'; pi: number } | { t: string; kind: 'mark'; ci: number } | { t: string; kind: 'own'; color: HighlightColor };
/** Split `text` at every boundary. Priority: marks > the user's own highlights > automatic sentence matches. Sentence whitespace is not highlighted. */
export function segments(text: string, sents: Pick<Sentence, 's' | 'e' | 'raw' | 'pi'>[], mrs: MarkHit[], marks: CollageMark[], own: Anchored[] = []): Seg[] {
  const hs: { s: number; e: number; pi: number }[] = [];
  sents.forEach(se => {
    if (se.pi == null) return;
    const lead = se.raw.length - se.raw.trimStart().length, trail = se.raw.length - se.raw.trimEnd().length;
    if (se.e - trail > se.s + lead) hs.push({ s: se.s + lead, e: se.e - trail, pi: se.pi });
  });
  const pts = new Set([0, text.length]); [...hs, ...mrs, ...own].forEach(h => { pts.add(h.s); pts.add(h.e); });
  const P = [...pts].filter(x => x >= 0 && x <= text.length).sort((a, b) => a - b), out: Seg[] = [];
  for (let k = 0; k < P.length - 1; k++) {
    const a = P[k], b = P[k + 1]; if (b <= a) continue; const t = text.slice(a, b);
    const m = mrs.find(x => x.s <= a && a < x.e), o = own.find(x => x.s <= a && a < x.e), h = hs.find(x => x.s <= a && a < x.e);
    if (m) out.push({ t, kind: 'mark', ci: marks[m.mi]?.ci ?? 0 }); else if (o) out.push({ t, kind: 'own', color: o.color });
    else if (h) out.push({ t, kind: 'hl', pi: h.pi }); else out.push({ t, kind: 'plain' });
  }
  return out;
}

/** The part of `segs` (a partition of some text) covering [s, e), with outer whitespace trimmed. */
export function cutSegs(segs: Seg[], s: number, e: number): Seg[] {
  const out: Seg[] = []; let at = 0;
  for (const g of segs) { const a = Math.max(s, at), b = Math.min(e, at + g.t.length); if (b > a) out.push({ ...g, t: g.t.slice(a - at, b - at) }); at += g.t.length; }
  while (out.length && !out[0].t.trim()) out.shift(); while (out.length && !out[out.length - 1].t.trim()) out.pop();
  if (out.length) { out[0] = { ...out[0], t: out[0].t.trimStart() }; const l = out.length - 1; out[l] = { ...out[l], t: out[l].t.trimEnd() }; }
  return out;
}
