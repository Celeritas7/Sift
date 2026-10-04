// Reference port of the prototype's relevance + map layout. Use server-side pg_trgm for stored links;
// use this client-side for live "while you type" suggestions and for layout.
export const grams = (t: string) => { const m = new Map<string, number>(); const s = t.toLowerCase().replace(/\s+/g, ' ');
  for (let i = 0; i < s.length - 2; i++) { const g = s.slice(i, i + 3); m.set(g, (m.get(g) || 0) + 1); } return m; };
export const cosine = (a: Map<string, number>, b: Map<string, number>) => { let d = 0, na = 0, nb = 0;
  a.forEach((v, k) => { na += v * v; const w = b.get(k); if (w) d += v * w; }); b.forEach(v => nb += v * v); return na && nb ? d / Math.sqrt(na * nb) : 0; };

export class TrigramIndex {
  private df = new Map<string, number>(); private w = new Map<string, Map<string, number>>(); private N = 0;
  constructor(docs: { id: string; text: string }[]) { const g = new Map<string, Map<string, number>>();
    docs.forEach(d => { const m = grams(d.text); g.set(d.id, m); m.forEach((_, k) => this.df.set(k, (this.df.get(k) || 0) + 1)); });
    this.N = docs.length; g.forEach((m, id) => this.w.set(id, this.weigh(m))); }
  weigh(g: Map<string, number>) { const w = new Map<string, number>(); const N = this.N || 1;
    g.forEach((v, k) => { const d = this.df.get(k) || 0; if (d / N > 0.5) return; w.set(k, (1 + Math.log(v)) * Math.log((N + 1) / (d + 0.5))); }); return w; }
  sim(a: string, b: string) { return cosine(this.w.get(a) || new Map(), this.w.get(b) || new Map()); }
  simText(text: string, id: string) { return cosine(this.weigh(grams(text)), this.w.get(id) || new Map()); }
  /** Weigh a draft once, then score it against many notes. */
  simVec(vec: Map<string, number>, id: string) { return cosine(vec, this.w.get(id) || new Map()); }
  vecOf(text: string) { return this.weigh(grams(text)); }
  /** Near-duplicate pairs (cosine >= min). Candidates share one of each note's three heaviest trigrams, so this stays fast on large imports. */
  nearDuplicates(ids: string[], min = SIM_DUPLICATE) {
    const keep = new Set(ids), post = new Map<string, string[]>(), seen = new Set<string>(), out: { a: string; b: string; sim: number }[] = [];
    ids.forEach(id => (this.w.get(id) || new Map()).forEach((_, g) => { const l = post.get(g); if (l) l.push(id); else post.set(g, [id]); }));
    ids.forEach(a => { const top = [...(this.w.get(a) || new Map()).entries()].sort((x, y) => y[1] - x[1]).slice(0, 3);
      top.forEach(([g]) => (post.get(g) || []).forEach(b => { if (b === a || !keep.has(b)) return; const k = a < b ? a + '|' + b : b + '|' + a; if (seen.has(k)) return; seen.add(k);
        const sim = this.sim(a, b); if (sim >= min) out.push({ a: a < b ? a : b, b: a < b ? b : a, sim }); })); });
    return out.sort((x, y) => y.sim - x.sim);
  }
}
export const SIM_MIN = 0.15, SIM_NEW = 0.06, SIM_RELATED = 0.10, SIM_DUPLICATE = 0.9;

// Map layout: polar seed by topic + age, then collision relaxation. Units: x 0..100, y 0..62.5 (16:10 viewBox).
export function layoutMap(notes: { id: string; topic: string; ts: number }[], topics: string[], overrides: Record<string, { x: number; y: number }> = {}) {
  const pos: Record<string, { x: number; y: number; flip: boolean }> = {};
  const ts = notes.map(n => n.ts), minT = Math.min(...ts), maxT = Math.max(...ts);
  const step = (Math.PI * 2) / Math.max(1, notes.length + topics.length); let idx = 0;
  topics.forEach(t => { notes.filter(n => n.topic === t).sort((a, b) => a.ts - b.ts).forEach((n, k) => {
    const ang = -Math.PI / 2 + idx * step, age = (maxT - n.ts) / ((maxT - minT) || 1), r = 16 + age * 14;
    pos[n.id] = { x: 50 + r * Math.cos(ang), y: 31.25 + r * 0.86 * Math.sin(ang), flip: k % 2 === 1 }; idx++; }); idx++; });
  const ids = Object.keys(pos), RX = 18, RY = 11;
  for (let it = 0; it < 60; it++) { for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const A = pos[ids[i]], B = pos[ids[j]]; let dx = (B.x - A.x) / RX, dy = (B.y - A.y) / RY;
      if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) { dx = 0.01 * (i % 2 ? 1 : -1); dy = 0.01; }
      const d = Math.hypot(dx, dy); if (d < 1) { const p = (1 - d) / 2; A.x -= dx / d * p * RX; A.y -= dy / d * p * RY; B.x += dx / d * p * RX; B.y += dy / d * p * RY; } }
    ids.forEach(k => { pos[k].x = Math.min(90, Math.max(10, pos[k].x)); pos[k].y = Math.min(53, Math.max(9, pos[k].y)); }); }
  ids.forEach(k => { if (overrides[k]) { pos[k].x = overrides[k].x; pos[k].y = overrides[k].y; } });
  return pos;
}
