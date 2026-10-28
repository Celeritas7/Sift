// Draws the chat video frame by frame on a 720×1280 canvas and records it with MediaRecorder. Nothing leaves the device.
import type { ChatMsg } from './chat';
import { durationMs, H, msgStart, prog, scrollAt, T_MSG, T_REACT, W, wrap } from './video';
import { MONO, SANS, SERIF } from './config';

export interface Palette { bg: string; sf: string; sf2: string; ink: string; mu: string; ln: string; ac: string; }
export interface SceneInput { msgs: ChatMsg[]; quote: (id: string) => { topic: string; title: string } | null; c: Palette; color: (topic: string) => string; name: (topic: string) => string; initials: (topic: string) => string; members: string[]; }

const PAD = 40, AV = 52, BX = PAD + AV + 16, BW = W - BX - PAD, IN = 22, TOP = 210, BOTTOM = H - 110;
const F = { title: `400 30px ${SERIF}`, sum: `400 23px ${SANS}`, name: `600 22px ${SANS}`, small: `500 17px ${MONO}`, qname: `600 19px ${SANS}`, qtitle: `400 21px ${SANS}`, emoji: `24px ${SANS}`, head: `500 52px ${SERIF}`, sub: `400 24px ${SANS}`, av: `500 18px ${MONO}` };
const LH = { title: 38, sum: 31 };

interface Block { m: ChatMsg; y: number; h: number; dayY: number | null; nameY: number | null; bubbleY: number; bubbleH: number; bubbleW: number; quote: { topic: string; lines: string[] } | null; title: string[]; sum: string[]; reactY: number | null; }
export interface Scene { blocks: Block[]; input: SceneInput; duration: number; }

/** Fonts must be loaded before measuring, or the layout is computed with fallback widths. */
export async function loadFonts() { try { await Promise.all([F.title, F.sum, F.name, F.small].map(f => document.fonts.load(f))); await document.fonts.ready; } catch { /* draw with what we have */ } }

export function buildScene(ctx: CanvasRenderingContext2D, input: SceneInput): Scene {
  const measure = (font: string) => (s: string) => { ctx.font = font; return ctx.measureText(s).width; };
  let y = 0; const blocks: Block[] = [];
  input.msgs.forEach(m => {
    const b: Partial<Block> = { m, dayY: null, nameY: null, reactY: null };
    y += m.first ? 26 : 10; const top = y;
    if (m.day) { b.dayY = y; y += 56; }
    if (m.first) { b.nameY = y; y += 32; }
    const inner = BW - IN * 2;
    const q = m.replyTo ? input.quote(m.replyTo) : null;
    b.quote = q ? { topic: q.topic, lines: wrap(q.title || 'Untitled', inner - 30, measure(F.qtitle), 1) } : null;
    b.title = wrap(m.title, inner, measure(F.title), 4);
    b.sum = m.sum && m.sum !== m.title ? wrap(m.sum, inner, measure(F.sum), 3) : [];
    let bh = 18 + (q ? 74 + 12 : 0) + b.title.length * LH.title + (b.sum.length ? 6 + b.sum.length * LH.sum : 0) + 30 + 12;
    const widest = Math.max(...b.title.map(measure(F.title)), ...b.sum.map(measure(F.sum)), q ? measure(F.qtitle)(b.quote!.lines[0] ?? '') + 30 : 0, 120);
    b.bubbleW = Math.min(BW, Math.ceil(widest + IN * 2)); if (q) b.bubbleW = BW;
    b.bubbleY = y; b.bubbleH = bh; y += bh;
    if (m.reactions.length) { b.reactY = y + 8; y += 52; }
    b.y = top; b.h = y - top; blocks.push(b as Block);
  });
  return { blocks, input, duration: durationMs(blocks.length) };
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | [number, number, number, number]) {
  const [a, b, c, d] = typeof r === 'number' ? [r, r, r, r] : r;
  ctx.beginPath(); ctx.moveTo(x + a, y); ctx.lineTo(x + w - b, y); ctx.quadraticCurveTo(x + w, y, x + w, y + b); ctx.lineTo(x + w, y + h - c); ctx.quadraticCurveTo(x + w, y + h, x + w - c, y + h);
  ctx.lineTo(x + d, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - d); ctx.lineTo(x, y + a); ctx.quadraticCurveTo(x, y, x + a, y); ctx.closePath();
}

function avatar(ctx: CanvasRenderingContext2D, s: Scene, topic: string, x: number, y: number, size: number) {
  ctx.fillStyle = s.input.color(topic); ctx.beginPath(); ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `500 ${Math.round(size * .34)}px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s.input.initials(topic), x + size / 2, y + size / 2 + 1);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

export function drawFrame(ctx: CanvasRenderingContext2D, s: Scene, t: number) {
  const { c } = s.input; const n = s.blocks.length;
  ctx.fillStyle = c.bg; ctx.fillRect(0, 0, W, H);
  // Header: title, member avatars.
  ctx.globalAlpha = prog(t, 0, 600);
  ctx.fillStyle = c.ink; ctx.font = F.head; ctx.fillText('Your topics, talking', PAD, 96);
  s.input.members.forEach((tp, i) => avatar(ctx, s, tp, PAD + i * 40, 122, 48));
  ctx.fillStyle = c.mu; ctx.font = F.sub; ctx.fillText(`${n} notes · ${s.input.members.length} topics`, PAD + s.input.members.length * 40 + 24, 154);
  ctx.globalAlpha = 1; ctx.fillStyle = c.ln; ctx.fillRect(PAD, TOP - 18, W - PAD * 2, 2);

  ctx.save(); ctx.beginPath(); ctx.rect(0, TOP - 16, W, BOTTOM - TOP + 16); ctx.clip();
  const scroll = scrollAt(t, s.blocks.map(b => b.y + b.h), BOTTOM - TOP - 16);
  s.blocks.forEach((b, i) => {
    const at = msgStart(i); if (t < at) return; const p = prog(t, at, 380);
    const dy = TOP - scroll + (1 - p) * 28; if (dy + b.y + b.h < TOP - 40 || dy + b.y > BOTTOM + 40) return;
    ctx.globalAlpha = p; const m = b.m, col = s.input.color(m.topic);
    if (b.dayY != null) { ctx.font = F.small; const w = ctx.measureText(m.day!.toUpperCase()).width + 32; ctx.fillStyle = c.sf2; rr(ctx, (W - w) / 2, dy + b.dayY + 6, w, 34, 17); ctx.fill(); ctx.fillStyle = c.mu; ctx.fillText(m.day!.toUpperCase(), (W - w) / 2 + 16, dy + b.dayY + 29); }
    if (b.nameY != null) { avatar(ctx, s, m.topic, PAD, dy + b.nameY, AV); ctx.fillStyle = col; ctx.font = F.name; ctx.fillText(s.input.name(m.topic), BX, dy + b.nameY + 22); }
    const by = dy + b.bubbleY; ctx.fillStyle = c.sf; rr(ctx, BX, by, b.bubbleW, b.bubbleH, b.nameY != null ? [6, 24, 24, 24] : 24); ctx.fill(); ctx.strokeStyle = c.ln; ctx.lineWidth = 2; ctx.stroke();
    let ty = by + 18;
    if (b.quote) { const qc = s.input.color(b.quote.topic); ctx.fillStyle = c.sf2; rr(ctx, BX + IN, ty, b.bubbleW - IN * 2, 74, 10); ctx.fill(); ctx.fillStyle = qc; ctx.fillRect(BX + IN, ty, 5, 74);
      ctx.font = F.qname; ctx.fillText('↩ ' + s.input.name(b.quote.topic), BX + IN + 18, ty + 28); ctx.fillStyle = c.mu; ctx.font = F.qtitle; ctx.fillText(b.quote.lines[0] ?? '', BX + IN + 18, ty + 58); ty += 86; }
    ctx.fillStyle = c.ink; ctx.font = F.title; b.title.forEach(l => { ty += LH.title; ctx.fillText(l, BX + IN, ty - 9); });
    if (b.sum.length) { ty += 6; ctx.fillStyle = c.mu; ctx.font = F.sum; b.sum.forEach(l => { ty += LH.sum; ctx.fillText(l, BX + IN, ty - 8); }); }
    ctx.font = F.small; ctx.fillStyle = c.mu; const tm = new Date(m.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); ctx.fillText(tm, BX + b.bubbleW - IN - ctx.measureText(tm).width, by + b.bubbleH - 14);
    // Reactions pop in one after another.
    if (b.reactY != null) { let rx = BX; m.reactions.forEach((r, k) => {
      const rp = prog(t, at + T_REACT + k * 120, 260); if (rp <= 0) return; const label = r.n > 1 ? String(r.n) : '';
      ctx.font = F.small; const w = 52 + (label ? ctx.measureText(label).width + 6 : 0); const sc = .6 + .4 * rp;
      ctx.save(); ctx.globalAlpha = p * rp; ctx.translate(rx + w / 2, dy + b.reactY! + 20); ctx.scale(sc, sc); ctx.translate(-w / 2, -20);
      ctx.fillStyle = c.bg; rr(ctx, 0, 0, w, 40, 20); ctx.fill(); ctx.strokeStyle = c.ln; ctx.stroke();
      ctx.font = F.emoji; ctx.fillText(r.emoji, 12, 29); if (label) { ctx.font = F.small; ctx.fillStyle = c.mu; ctx.fillText(label, 46, 27); }
      ctx.restore(); rx += w + 8; }); }
    ctx.globalAlpha = 1;
  });
  ctx.restore();
  // Footer.
  ctx.fillStyle = c.mu; ctx.font = F.small; ctx.textAlign = 'center'; ctx.fillText('made with Sift', W / 2, H - 46); ctx.textAlign = 'left';
  const end = msgStart(n - 1) + T_MSG; if (t > end) { ctx.globalAlpha = prog(t, end, 500) * .9; ctx.fillStyle = c.ac; rr(ctx, W / 2 - 90, H - 76, 180, 4, 2); ctx.fill(); ctx.globalAlpha = 1; }
}

/** Plays the scene in real time onto `canvas` while recording it. Resolves with the video, or rejects if stopped. */
export function recordScene(canvas: HTMLCanvasElement, s: Scene, mime: string, onProgress: (p: number) => void, signal: AbortSignal): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const ctx = canvas.getContext('2d')!; const stream = canvas.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 }); const chunks: Blob[] = [];
    let raf = 0, aborted = false; const t0 = performance.now();
    const stop = (why?: string) => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', vis); if (why) { aborted = true; reject(new Error(why)); } if (rec.state !== 'inactive') rec.stop(); stream.getTracks().forEach(tr => tr.stop()); };
    const vis = () => { if (document.hidden) stop('Recording stopped because Sift went to the background. Keep it open until the video is ready.'); };
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => { if (!aborted) resolve(new Blob(chunks, { type: mime.split(';')[0] })); };
    signal.addEventListener('abort', () => stop('Cancelled'));
    document.addEventListener('visibilitychange', vis);
    const tick = () => { const t = performance.now() - t0; drawFrame(ctx, s, Math.min(t, s.duration)); onProgress(Math.min(1, t / s.duration)); if (t >= s.duration) { stop(); return; } raf = requestAnimationFrame(tick); };
    drawFrame(ctx, s, 0); rec.start(500); raf = requestAnimationFrame(tick);
  });
}
