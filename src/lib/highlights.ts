// Manual highlights: the user's own marker strokes on a note. Stored as quote + start; offsets shift when a note is edited.
import type { Highlight, HighlightColor } from '../types';

export const HL_COLORS: { id: HighlightColor; label: string; light: string; dark: string }[] = [
  { id: 'yellow', label: 'Yellow', light: '#FFE53B', dark: 'oklch(0.52 0.11 95)' },
  { id: 'pink', label: 'Pink', light: 'oklch(0.86 0.12 350)', dark: 'oklch(0.48 0.12 350)' },
  { id: 'green', label: 'Green', light: 'oklch(0.88 0.14 150)', dark: 'oklch(0.48 0.11 150)' },
  { id: 'blue', label: 'Blue', light: 'oklch(0.86 0.1 235)', dark: 'oklch(0.48 0.11 235)' },
];
export const ownColor = (c: HighlightColor, dark: boolean) => { const o = HL_COLORS.find(x => x.id === c) ?? HL_COLORS[0]; return dark ? o.dark : o.light; };

/** A highlight placed on the current text. */
export interface Anchored { id: string; s: number; e: number; color: HighlightColor; }

/** Where `h.quote` sits in `text` now: at `start` if unchanged, else the occurrence nearest `start`; null when the quote is gone. */
export function anchor(text: string, h: Pick<Highlight, 'quote' | 'start'>): number | null {
  if (!h.quote) return null;
  if (text.startsWith(h.quote, h.start)) return h.start;
  let best: number | null = null;
  for (let i = text.indexOf(h.quote); i !== -1; i = text.indexOf(h.quote, i + 1)) if (best == null || Math.abs(i - h.start) < Math.abs(best - h.start)) best = i;
  return best;
}

/** Anchored, non-overlapping highlights of one note, in text order (earlier highlight wins an overlap). */
export function anchorAll(text: string, list: Highlight[]): Anchored[] {
  const out: Anchored[] = [];
  list.forEach(h => { const s = anchor(text, h); if (s != null) out.push({ id: h.id, s, e: s + h.quote.length, color: h.color }); });
  out.sort((a, b) => a.s - b.s || b.e - a.e);
  const clean: Anchored[] = []; let end = -1;
  for (const a of out) if (a.s >= end) { clean.push(a); end = a.e; }
  return clean;
}
