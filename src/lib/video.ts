// Chat video: timing, text wrapping and format choice. Pure, so it can be tested without a canvas.

/** 9:16, the shape phones and messaging apps expect. */
export const W = 720, H = 1280;
export const T_INTRO = 1200, T_MSG = 1500, T_OUTRO = 2000, T_REACT = 750;
export const LENGTHS = [10, 20, 40] as const;

export const durationMs = (n: number) => T_INTRO + n * T_MSG + T_OUTRO;
/** When message i starts appearing. */
export const msgStart = (i: number) => T_INTRO + i * T_MSG;
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
/** 0→1 progress of something that starts at `at` and takes `len` ms. */
export const prog = (t: number, at: number, len: number) => easeOut((t - at) / len);

/** Wraps on spaces; a word wider than the line (or text with no spaces, e.g. Japanese) breaks between characters. Over `maxLines`, the last line ends in "…". */
export function wrap(text: string, maxW: number, measure: (s: string) => number, maxLines = Infinity): string[] {
  const lines: string[] = []; let cur = '';
  const push = (l: string) => { lines.push(l); };
  for (const word of text.replace(/\s+/g, ' ').trim().split(' ')) {
    const tryLine = cur ? cur + ' ' + word : word;
    if (measure(tryLine) <= maxW) { cur = tryLine; continue; }
    if (cur) { push(cur); cur = ''; }
    if (measure(word) <= maxW) { cur = word; continue; }
    for (const ch of Array.from(word)) { if (measure(cur + ch) > maxW && cur) { push(cur); cur = ''; } cur += ch; }
  }
  if (cur) push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines); let last = kept[maxLines - 1];
    while (last && measure(last + '…') > maxW) last = Array.from(last).slice(0, -1).join('');
    kept[maxLines - 1] = last.trimEnd() + '…'; return kept;
  }
  return lines;
}

/** First supported recording format: MP4 when the browser can (WhatsApp and LINE play it), else WebM. */
export function pickMime(supported: (m: string) => boolean): { mime: string; ext: 'mp4' | 'webm' } | null {
  for (const mime of ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1.4D401F', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'])
    if (supported(mime)) return { mime, ext: mime.startsWith('video/mp4') ? 'mp4' : 'webm' };
  return null;
}

/** How far the message stack has scrolled at time t: it eases so the newest visible message sits above `bottom`. */
export function scrollAt(t: number, bottoms: number[], bottom: number): number {
  const need = (i: number) => Math.max(0, bottoms[i] - bottom);
  let i = -1; for (let k = 0; k < bottoms.length; k++) if (t >= msgStart(k)) i = k;
  if (i < 0) return 0;
  const before = i > 0 ? need(i - 1) : 0;
  return before + (need(i) - before) * prog(t, msgStart(i), 450);
}
