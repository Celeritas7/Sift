import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react';
import { useStore } from '../state/store';
import { useIsMobile, usePalette } from '../state/derived';
import { MONO, SERIF, topicName } from '../lib/config';
import { plural } from '../lib/format';
import { cutSegs, findMarks, hash, hitLine, hl, look, MK, mkBg, mkLine, NOTE_BGS, rnd, segments, type Para, type Seg } from '../lib/collage';
import { ownColor } from '../lib/highlights';
import { Highlighted, useCollageRows, type CollageRow } from '../components/CollageText';
import { eyebrowStyle } from '../components/ui';
import type { CollageMark, LayoutKind } from '../types';

const fmt = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const pill: CSSProperties = { display: 'flex', gap: 2, padding: 3, borderRadius: 999, background: 'var(--sf)', border: '1px solid var(--ln)' };
const smallBtn: CSSProperties = { padding: '4px 10px', border: '1px solid var(--ln)', borderRadius: 999, background: 'transparent', fontSize: 12 };
const MARK_INK = '#221E1A';

function useWide(q = '(min-width: 860px)') {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => { const mq = window.matchMedia(q); const f = () => setM(mq.matches); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f); }, [q]);
  return m;
}

function Switch<T extends string>({ value, opts, onPick, label }: { value: T; opts: [T, string][]; onPick: (v: T) => void; label: string }) {
  const { c } = usePalette();
  return <div role="group" aria-label={label} style={pill}>
    {opts.map(([v, t]) => <button key={v} aria-pressed={value === v} onClick={() => onPick(v)}
      style={{ padding: '5px 12px', border: 0, borderRadius: 999, background: value === v ? c.ink : 'transparent', color: value === v ? c.bg : c.ink, fontSize: 12 }}>{t}</button>)}
  </div>;
}

export function Collage() {
  const cfg = useStore(s => s.collage), setCollage = useStore(s => s.setCollage); const { c } = usePalette(); const wide = useWide(), gutter = useIsMobile() ? 16 : 36;
  // Phones: the board is narrower than 520px exactly when the viewport is 520px plus both page gutters (36px each) or less.
  const narrow = useWide('(max-width: 591px)');
  const { rows, paras, marks, live, lockedCount } = useCollageRows();
  const shown = cfg.filter === 'own' ? rows.filter(r => r.own.length) : cfg.filter === 'hide' ? rows.filter(r => r.ok) : rows;
  const matched = rows.filter(r => r.ok).length, sentN = rows.reduce((a, r) => a + r.m.hits.length, 0), ownN = rows.filter(r => r.own.length).length;

  return <>
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px 14px' }}>
      <span style={eyebrowStyle}>Collage</span>
      <Switch label="Look" value={cfg.concept} opts={[['sticky', 'A · Sticky notes'], ['marker', 'B · Highlighters']]} onPick={concept => setCollage({ concept })} />
      {cfg.concept === 'marker' && <div role="group" aria-label="Note color" style={{ ...pill, alignItems: 'center', gap: 6, padding: '3px 10px 3px 12px' }}>
        <span style={{ fontSize: 12, color: 'var(--mu)', marginRight: 2 }}>Note color</span>
        {NOTE_BGS.map(o => <button key={o.id} title={o.label} aria-label={o.label} aria-pressed={cfg.noteBg === o.id} onClick={() => setCollage({ noteBg: o.id })}
          style={{ width: 20, height: 20, borderRadius: '50%', padding: 0, background: o.bg ?? c.sf, border: '1px solid rgba(0,0,0,.18)', boxShadow: cfg.noteBg === o.id ? '0 0 0 2px var(--sf), 0 0 0 4px var(--ac)' : 'none' }} />)}
      </div>}
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 13, color: 'var(--mu)' }}>{cfg.filter === 'own' ? `${ownN} of ${plural(rows.length, 'note')} with your highlights`
        : live ? `${matched} of ${plural(rows.length, 'note')} · ${plural(sentN, 'sentence')}` : plural(rows.length, 'note')}</span>
      <Switch label="View" value={cfg.view} opts={[['board', 'Board'], ['scatter', 'Scatter']]} onPick={view => setCollage({ view })} />
      <Switch label="Other notes" value={cfg.filter} opts={[['hide', 'Hide others'], ['dim', 'Dim others'], ['own', 'Only my highlights']]} onPick={filter => setCollage({ filter })} />
      <button className="h-ac" aria-pressed={cfg.tilt} onClick={() => setCollage({ tilt: !cfg.tilt })} style={{ ...smallBtn, padding: '6px 12px', background: 'var(--sf)', color: cfg.tilt ? 'var(--ink)' : 'var(--mu)' }}>Tilt {cfg.tilt ? 'on' : 'off'}</button>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: wide ? 'minmax(280px,360px) minmax(0,1fr)' : 'minmax(0,1fr)', gap: 28, alignItems: 'start', marginTop: -16 }}>
      <Pad rows={rows} paras={paras} sticky={wide} fold={narrow} />
      <section aria-label="Matching notes" style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {cfg.filter === 'own' && !ownN && rows.length ? <div style={{ padding: '48px 24px', border: '1px dashed var(--ln)', borderRadius: 16, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
          <span style={{ fontFamily: SERIF, fontSize: 22 }}>No highlights yet</span>
          <span style={{ color: 'var(--mu)' }}>Open a note and select some text to highlight it.</span>
        </div> : live && matched === 0 && cfg.filter === 'hide' ? <div style={{ padding: '48px 24px', border: '1px dashed var(--ln)', borderRadius: 16, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
          <span style={{ fontFamily: SERIF, fontSize: 22 }}>No note says anything like this yet</span>
          <span style={{ color: 'var(--mu)' }}>Try another paragraph, or turn on the ones you switched off.</span>
        </div> : !rows.length ? <p style={{ margin: 0, fontFamily: SERIF, fontSize: 22, fontStyle: 'italic', color: 'var(--mu)' }}>No notes yet.</p>
          : cfg.view === 'board' ? <Board shown={shown} marks={marks} live={live} /> : <Scatter shown={shown} marks={marks} narrow={narrow} bleed={gutter} />}
        {lockedCount > 0 && <div style={{ fontSize: 12, color: 'var(--mu)' }}>{plural(lockedCount, 'vault note')} {lockedCount === 1 ? 'is' : 'are'} left out of the collage.</div>}
      </section>
    </div>
  </>;
}

// ---------- left panel ----------
function Pad({ rows, paras, sticky, fold }: { rows: CollageRow[]; paras: Para[]; sticky: boolean; fold: boolean }) {
  const cfg = useStore(s => s.collage), setCollage = useStore(s => s.setCollage); const { c, dark } = usePalette();
  const ref = useRef<HTMLTextAreaElement>(null); const [flash, setFlash] = useState(''); const ft = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(ft.current), []);
  const [open, setOpen] = useState(false);
  // Phones: folded into a bar above the collage, so Scatter gets the whole screen width.
  if (fold && !open) return <button className="h-ac" aria-expanded={false} onClick={() => setOpen(true)}
    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px 16px', border: '1px solid var(--ln)', borderRadius: 14, background: 'var(--sf)', textAlign: 'left', fontSize: 13 }}>
    <span style={eyebrowStyle}>Your writing</span>
    <span style={{ flex: 1, minWidth: 0, color: 'var(--mu)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>· {plural(paras.length, 'paragraph')} · {plural(cfg.marks.length, 'mark')}</span>
    <span aria-hidden="true" style={{ color: 'var(--mu)' }}>▾</span>
  </button>;
  const say = (msg: string) => { clearTimeout(ft.current); setFlash(msg); ft.current = setTimeout(() => setFlash(''), 2600); };

  const addMark = (ci: number) => {
    const el = ref.current; if (!el) return;
    const t = cfg.pad.slice(el.selectionStart, el.selectionEnd).replace(/\s+/g, ' ').trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (t.length < 2) { say('Select a word in your writing first'); return; }
    const i = cfg.marks.findIndex(m => m.t.toLowerCase() === t.toLowerCase()); const marks: CollageMark[] = [...cfg.marks];
    if (i >= 0) marks[i] = { ...marks[i], ci }; else marks.push({ t, ci });
    setCollage({ marks });
  };
  const paste = async () => { try { const t = await navigator.clipboard.readText(); if (t) setCollage({ pad: t, muted: [] }); } catch { /* clipboard blocked */ } };

  // Backdrop: same text, transparent ink, marked phrases painted behind the transparent textarea.
  const back: { t: string; ci: number | null }[] = []; let pp = 0;
  findMarks(cfg.pad, cfg.marks).forEach(m => { if (m.s > pp) back.push({ t: cfg.pad.slice(pp, m.s), ci: null }); back.push({ t: cfg.pad.slice(m.s, m.e), ci: cfg.marks[m.mi].ci }); pp = m.e; });
  back.push({ t: cfg.pad.slice(pp) + '\n ', ci: null });
  const text: CSSProperties = { gridArea: '1/1', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', fontFamily: SERIF, fontSize: 17, lineHeight: 1.5, padding: 0, margin: 0 };

  return <aside aria-label="Your writing" style={{ position: sticky ? 'sticky' : 'static', top: 84, display: 'flex', flexDirection: 'column', gap: 14, padding: 18, border: '1px solid var(--ln)', borderRadius: 16, background: 'var(--sf)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {fold ? <button aria-expanded onClick={() => setOpen(false)} style={{ ...eyebrowStyle, flex: 1, border: 0, background: 'transparent', padding: 0, textAlign: 'left' }}>Your writing ▴</button>
        : <span style={{ ...eyebrowStyle, flex: 1 }}>Your writing</span>}
      <button className="h-ac" onClick={() => void paste()} style={smallBtn}>Paste</button>
      <button className="h-ac" onClick={() => setCollage({ pad: '', muted: [], marks: [] })} style={smallBtn}>Clear</button>
    </div>
    <div style={{ display: 'grid', minHeight: 200 }}>
      <div aria-hidden="true" style={{ ...text, color: 'transparent', pointerEvents: 'none' }}>
        {back.map((g, i) => <span key={i} style={g.ci == null ? undefined : { background: mkBg(g.ci, dark), borderRadius: 3, boxShadow: `0 0 0 2px ${mkBg(g.ci, dark)}, inset 0 -2px 0 ${mkLine(g.ci)}` }}>{g.t}</span>)}
      </div>
      <textarea ref={ref} value={cfg.pad} onChange={e => setCollage({ pad: e.target.value })} aria-label="Your writing"
        placeholder="Write or paste your paragraphs here. Select a word and pick a color below to mark it as important."
        style={{ ...text, width: '100%', height: '100%', resize: 'none', overflow: 'hidden', border: 0, outline: 'none', background: 'transparent', caretColor: 'var(--ink)' }} />
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 12, borderTop: '1px solid var(--ln)' }}>
      <span style={{ fontSize: 12, color: 'var(--mu)' }}>Mark selected words</span>
      {MK.map((m, i) => <button key={m.label} title={'Mark in ' + m.label.toLowerCase()} aria-label={'Mark selected words in ' + m.label.toLowerCase()}
        onPointerDown={e => { e.preventDefault(); addMark(i); }} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addMark(i); } }}
        style={{ width: 24, height: 24, borderRadius: 6, padding: 0, border: 0, background: mkBg(i, false), boxShadow: 'inset 0 -3px 0 ' + mkLine(i) }} />)}
      <span role="status" style={{ fontSize: 12, color: 'var(--ac)' }}>{flash}</span>
    </div>
    {cfg.marks.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {cfg.marks.map((m, i) => <span key={m.t} style={{ display: 'flex', alignItems: 'center', padding: '3px 2px 3px 8px', borderRadius: 6, background: mkBg(m.ci, false), boxShadow: 'inset 0 -2px 0 ' + mkLine(m.ci), color: MARK_INK, fontSize: 12 }}>
        <button title="Change color" onClick={() => setCollage({ marks: cfg.marks.map((x, j) => j === i ? { ...x, ci: (x.ci + 1) % MK.length } : x) })} style={{ border: 0, background: 'transparent', padding: 0, fontWeight: 600, color: MARK_INK }}>{m.t}</button>
        <span style={{ marginLeft: 6, opacity: .7 }} title="Notes containing it">{rows.filter(r => r.m.mrs.some(h => h.mi === i)).length}</span>
        <button title="Remove mark" aria-label={'Remove mark ' + m.t} onClick={() => setCollage({ marks: cfg.marks.filter((_, j) => j !== i) })} style={{ border: 0, background: 'transparent', padding: '0 6px', fontSize: 15, lineHeight: 1, color: MARK_INK }}>×</button>
      </span>)}
    </div>}
    {paras.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12, borderTop: '1px solid var(--ln)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ ...eyebrowStyle, flex: 1 }}>Paragraphs</span><span style={{ fontSize: 12, color: 'var(--mu)' }}>tap to turn off</span>
      </div>
      {paras.map(p => { const nN = rows.filter(r => r.m.pis.includes(p.i)).length, sN = rows.reduce((a, r) => a + r.m.hits.filter(h => h.pi === p.i).length, 0);
        return <button key={p.i} className="h-ac" aria-pressed={!p.muted} onClick={() => setCollage({ muted: p.muted ? cfg.muted.filter(x => x !== p.i) : [...cfg.muted, p.i] })}
          style={{ display: 'grid', gridTemplateColumns: '14px minmax(0,1fr)', gap: 10, alignItems: 'start', textAlign: 'left', padding: '9px 10px', border: '1px solid var(--ln)', borderRadius: 10, background: 'var(--bg)', opacity: p.muted ? .55 : 1 }}>
          <span style={{ width: 14, height: 14, marginTop: 3, borderRadius: 4, background: p.muted ? c.sf2 : hl(p.i, cfg.concept, dark) }} />
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 13, lineHeight: 1.4, textDecoration: p.muted ? 'line-through' : 'none' }}>{p.t.length > 90 ? p.t.slice(0, 90) + '…' : p.t}</span>
            <span style={{ fontSize: 11, color: 'var(--mu)' }}>{p.muted ? 'Off' : `${plural(sN, 'sentence')} in ${plural(nN, 'note')}`}</span>
          </span>
        </button>; })}
    </div>}
  </aside>;
}

// ---------- board ----------
function Board({ shown, marks, live }: { shown: CollageRow[]; marks: CollageMark[]; live: boolean }) {
  const cfg = useStore(s => s.collage), openNote = useStore(s => s.openNote); const { c, dark } = usePalette();
  return <div style={{ columnWidth: 260, columnGap: 22 }}>
    {shown.map(({ n, m, own, ok }) => { const L = look(n.id, n.topic, cfg, c, dark); const line = [live && ok ? hitLine(m, marks) : '', own.length ? plural(own.length, 'highlight') : ''].filter(Boolean).join(' · ');
      return <button key={n.id} onClick={() => openNote(n.id)} style={{ position: 'relative', display: 'block', width: '100%', breakInside: 'avoid', margin: '10px 0 24px', padding: '20px 18px 16px',
        border: '1px solid ' + L.border, borderRadius: L.radius, background: L.bg, color: L.ink, textAlign: 'left', boxShadow: L.shadow,
        transform: `rotate(${cfg.tilt ? ((hash(n.id) % 7) - 3) * 0.45 : 0}deg)`, opacity: ok ? 1 : .35, transition: 'opacity .3s,box-shadow .2s,background .2s' }}>
        {L.tape && <span aria-hidden="true" style={{ position: 'absolute', top: -9, left: 'calc(50% - 30px)', width: 60, height: 18, background: L.tape, transform: `rotate(${L.tapeRot}deg)`, borderRadius: 1 }} />}
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: MONO, fontSize: 10, letterSpacing: '.05em', textTransform: 'uppercase', color: L.mu, marginBottom: 8 }}>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{topicName(n.topic)}</span><span>{fmt(n.ts)}</span>
        </span>
        <span style={{ display: 'block', fontFamily: SERIF, fontSize: 19, fontWeight: 500, lineHeight: 1.2, letterSpacing: '-.01em', marginBottom: 8, textWrap: 'pretty' }}>{n.title || 'Untitled'}</span>
        <span style={{ display: 'block', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>
          <Highlighted segs={segments(n.body, m.sents, m.mrs, marks, own)} concept={cfg.concept} dark={L.dark} />
        </span>
        {line && <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 12 }}>
          {[...new Set(own.map(o => o.color))].map(k => <span key={'o' + k} style={{ width: 8, height: 8, borderRadius: 2, background: ownColor(k, L.dark) }} />)}
          {live && m.pis.map(i => <span key={'p' + i} style={{ width: 8, height: 8, borderRadius: 2, background: hl(i, cfg.concept, L.dark) }} />)}
          {live && m.mset.map(i => <span key={'m' + i} style={{ width: 8, height: 8, borderRadius: 2, background: mkLine(marks[i].ci) }} />)}
          <span style={{ marginLeft: 4, fontSize: 11, color: L.mu }}>{line}</span>
        </span>}
      </button>; })}
  </div>;
}

// ---------- scatter ----------
interface Ghost { id: string; rot: number; t: string; x: number; y: number; fs: string; ink: string; bg: string; sh: string; }
/** sx/sy: where the pointer went down (client px), s0: window.scrollY then, cx/cy: latest pointer position. key/W/cw: the board it started on. */
interface Drag { id: string; pid: number; sx: number; sy: number; s0: number; cx: number; cy: number; ox: number; oy: number; x: number; y: number;
  key: LayoutKind; W: number; cw: number; moved: boolean; armed: boolean; touch: boolean; tap: boolean; hold?: ReturnType<typeof setTimeout>; }

/** Up to 3 passages worth showing: the user's own highlights first (widened to whole sentences, in text order),
 *  then top-scoring sentences and sentences holding marks, in text order. */
function picksFor({ n, m, own }: CollageRow, marks: CollageMark[]): Seg[][] {
  const at = (i: number) => m.sents.find(x => x.s <= i && i < x.e);
  const ranges: { s: number; e: number }[] = [];
  const add = (s: number, e: number) => { if (ranges.length < 3 && !ranges.some(r => r.s < e && s < r.e)) ranges.push({ s, e }); };
  own.forEach(o => add(at(o.s)?.s ?? o.s, at(o.e - 1)?.e ?? o.e));
  const first = ranges.length, rest: { s: number; e: number }[] = [];
  const picks = [...m.hits].sort((a, b) => b.sc - a.sc).slice(0, 3);
  m.mrs.filter(h => !picks.some(x => x.s <= h.s && h.s < x.e)).slice(0, 3 - Math.min(2, picks.length))
    .forEach(h => { const se = at(h.s); if (se && !picks.includes(se)) picks.push(se); });
  picks.sort((a, b) => a.s - b.s).forEach(se => { const before = ranges.length; add(se.s, se.e); if (ranges.length > before) rest.push(ranges.pop()!); });
  rest.slice(0, 3 - first).forEach(r => ranges.push(r));
  const all = segments(n.body, m.sents, m.mrs, marks, own);
  const out = ranges.map(r => cutSegs(all, r.s, r.e)).filter(g => g.length);
  if (out.length) return out;
  const t0 = n.body.replace(/\s+/g, ' ').trim();
  return [[{ t: t0.length > 140 ? t0.slice(0, 140) + '…' : t0, kind: 'plain' }]];
}

const HOLD_MS = 250, HOLD_SLOP = 8;
const NAV_H = 64;                // MobileNav: 4px padding + 44px buttons + 4px padding + 12px bottom margin
const EDGE = 60, EDGE_STEP = 12; // auto-scroll while dragging near the top/bottom of the viewport

function Scatter({ shown, marks, narrow, bleed }: { shown: CollageRow[]; marks: CollageMark[]; narrow: boolean; bleed: number }) {
  const key: LayoutKind = narrow ? 'collage-m' : 'collage';
  const cfg = useStore(s => s.collage), saved = useStore(s => s.layout[key]), shuffle = useStore(s => s.shuffleCollage); const { c, dark } = usePalette(); const navShown = useIsMobile();
  const boardRef = useRef<HTMLDivElement>(null); const [bw, setBw] = useState(900); const [, setTick] = useState(0);
  const drag = useRef<Drag | null>(null); const [dragPos, setDragPos] = useState<{ id: string; x: number; y: number } | null>(null);
  const [z, setZ] = useState<{ top: number; m: Record<string, number> }>({ top: 100, m: {} });
  const [ghosts, setGhosts] = useState<Ghost[]>([]); const gk = useRef(''); const [bottom, setBottom] = useState(0);
  const [arrange, setArrange] = useState(false); const arranging = arrange && narrow; const arrangeRef = useRef(arranging); arrangeRef.current = arranging;
  useEffect(() => { setZ({ top: 100, m: {} }); }, [cfg.seed]);
  useEffect(() => { if (!narrow) setArrange(false); }, [narrow]);
  const front = (id: string) => setZ(s => ({ top: s.top + 1, m: { ...s.m, [id]: s.top + 1 } }));

  /** Copy every mark span to a layer above all cards (marked words are never hidden), and find the lowest card bottom.
   *  Only sets state when something changed, so calling it after every render cannot loop. */
  const measure = () => { const b = boardRef.current; if (!b) return; const br = b.getBoundingClientRect(), out: Ghost[] = []; let low = 0;
    b.querySelectorAll<HTMLElement>('[data-cid]').forEach(card => { low = Math.max(low, card.offsetTop + card.offsetHeight); });
    b.querySelectorAll<HTMLElement>('[data-cid] [data-mk="1"]').forEach(el => { const card = el.closest<HTMLElement>('[data-cid]')!, r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      out.push({ id: card.dataset.cid!, rot: Number(card.dataset.rot) || 0, t: el.textContent || '', x: Math.round(r.left + r.width / 2 - br.left - b.clientLeft), y: Math.round(r.top + r.height / 2 - br.top - b.clientTop),
        fs: cs.fontSize, ink: cs.color, bg: cs.backgroundColor, sh: cs.boxShadow }); });
    setBottom(prev => (prev === low ? prev : low));
    const k = JSON.stringify(out); if (k !== gk.current) { gk.current = k; setGhosts(out); } };
  const measureRef = useRef(measure); measureRef.current = measure;
  useLayoutEffect(() => measure());

  // Board width, and re-measure the mark overlay once web fonts settle.
  useEffect(() => { const el = boardRef.current; if (!el) return; let alive = true;
    const ro = new ResizeObserver(() => { setBw(el.clientWidth); setTick(t => t + 1); }); ro.observe(el);
    void document.fonts?.ready.then(() => { if (alive) { gk.current = ''; setTick(t => t + 1); } });
    return () => { alive = false; ro.disconnect(); }; }, []);

  // Mouse: drag after 4px. Touch/pen: the page scrolls (touch-action: pan-y) unless the finger is held still for 250 ms;
  // after that the card follows the finger and scrolling is blocked. A quick tap opens the note.
  // Arrange mode (phones): cards use touch-action: none and follow the finger at once; taps don't open notes.
  useEffect(() => {
    let raf = 0;
    const clearHold = (d: Drag) => { clearTimeout(d.hold); d.hold = undefined; };
    // Card position from the finger in board coordinates, so it stays under the finger while the page auto-scrolls.
    // x is clamped to keep a quarter of the card on the board; y only has to stay below the top edge.
    const place = (d: Drag) => { d.x = Math.round(Math.min(d.W - d.cw * 0.75, Math.max(-d.cw * 0.25, d.ox + d.cx - d.sx)));
      d.y = Math.round(Math.max(0, d.oy + d.cy - d.sy + window.scrollY - d.s0)); setDragPos({ id: d.id, x: d.x, y: d.y }); };
    const tick = () => { const d = drag.current; if (!d?.moved) { raf = 0; return; }
      const h = window.innerHeight, v = d.cy < EDGE ? -(EDGE - d.cy) / EDGE : d.cy > h - EDGE ? (d.cy - h + EDGE) / EDGE : 0;
      if (v) { window.scrollBy({ top: Math.round(Math.max(-1, Math.min(1, v)) * EDGE_STEP) || Math.sign(v), behavior: 'instant' }); place(d); }
      raf = requestAnimationFrame(tick); };
    const mv = (e: PointerEvent) => { const d = drag.current; if (!d || e.pointerId !== d.pid) return; d.cx = e.clientX; d.cy = e.clientY; const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
      if (!d.armed) { if (Math.abs(dx) + Math.abs(dy) > HOLD_SLOP) { clearHold(d); drag.current = null; } return; } // moved before the hold: it's a scroll
      if (!d.moved && Math.abs(dx) + Math.abs(dy) <= 4) return; d.moved = true;
      place(d); if (!raf) raf = requestAnimationFrame(tick); };
    const end = (open: boolean) => (e: PointerEvent) => { const d = drag.current; if (!d || e.pointerId !== d.pid) return; clearHold(d); drag.current = null; const st = useStore.getState();
      // x is stored as a fraction of the board width, so a rotated phone or a resized window keeps the arrangement.
      if (d.moved) void st.setLayout(d.key, d.id, +(d.x / d.W).toFixed(4), d.y); else if (open && d.tap) st.openNote(d.id);
      setDragPos(null); };
    const up = end(true), cancel = end(false);
    // Once a touch drag is armed, stop the browser from turning the finger's movement into a scroll.
    const touch = (e: TouchEvent) => { if (drag.current?.armed && drag.current.touch && e.cancelable) e.preventDefault(); };
    const scroll = () => { if (drag.current?.moved) measureRef.current(); }; // the board moves under a dragged card while the page scrolls
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', cancel);
    window.addEventListener('touchmove', touch, { passive: false }); window.addEventListener('scroll', scroll, { passive: true, capture: true });
    return () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('touchmove', touch); window.removeEventListener('scroll', scroll, { capture: true }); cancelAnimationFrame(raf); if (drag.current) clearTimeout(drag.current.hold); };
  }, []);

  const W = narrow ? Math.max(200, bw) : Math.max(320, bw), cw = narrow ? Math.max(190, Math.round(W * 0.64)) : 250;
  const clampX = (x: number) => Math.round(Math.min(W - cw * 0.75, Math.max(-cw * 0.25, x)));
  // Saved x is a fraction of the board width; rows saved before that (px on the desktop board) are read as px.
  const fromSaved = (p: { x: number; y: number }) => ({ x: clampX(Math.abs(p.x) <= 2 ? p.x * W : p.x), y: Math.max(0, Math.round(p.y)) });
  const perRow = Math.max(1, Math.floor((W - cw) / (cw * 0.7)) + 1), stepX = perRow > 1 ? (W - cw) / (perRow - 1) : 0, stepY = 128;
  const cards = shown.map((r, idx) => { const { n } = r, h = hash(n.id) + cfg.seed * 977, row = Math.floor(idx / perRow), col = idx % perRow, shift = row % 2 ? stepX * 0.5 : 0;
    // Phones: a portrait zigzag, alternating left and right, each card 140px below the last so neighbours overlap by about a third.
    const auto = narrow ? { x: Math.round((idx % 2 ? W - cw - 8 : 8) + (rnd(h) - 0.5) * 24), y: 16 + idx * 140 }
      : { x: Math.round(Math.min(W - cw + 10, Math.max(-6, col * stepX + shift - (row % 2 && col === perRow - 1 ? stepX : 0) + (rnd(h) - 0.5) * 40))), y: Math.round(30 + row * stepY + rnd(h + 3) * 28) };
    const at = dragPos?.id === n.id ? dragPos : saved[n.id] ? fromSaved(saved[n.id]) : auto;
    return { r, at, rot: cfg.tilt ? +((rnd(h + 7) - 0.5) * (narrow ? 10 : 8)).toFixed(1) : 0, z: z.m[n.id] || (r.ok ? 50 : 1) + idx, L: look(n.id, n.topic, cfg, c, dark) };
  });
  const down = (e: RPointerEvent, id: string, at: { x: number; y: number }) => { if (e.button > 0 || drag.current) return;
    const touch = e.pointerType !== 'mouse', now = !touch || arrangeRef.current;
    if (!touch) e.preventDefault(); // mouse: no text selection; touch: leave the gesture to the browser so the page can scroll
    const d: Drag = { id, pid: e.pointerId, sx: e.clientX, sy: e.clientY, s0: window.scrollY, cx: e.clientX, cy: e.clientY, ox: at.x, oy: at.y, x: at.x, y: at.y,
      key, W, cw, moved: false, armed: now, touch, tap: !arrangeRef.current };
    if (!now) d.hold = setTimeout(() => { if (drag.current !== d) return; d.armed = true; d.tap = false; navigator.vibrate?.(10); front(id); }, HOLD_MS); else front(id);
    drag.current = d; };
  const byId = Object.fromEntries(cards.map(k => [k.r.n.id, k]));
  const noMenu = (e: React.MouseEvent) => { if (drag.current?.touch) e.preventDefault(); }; // long-press must not open the context menu
  const ta = arranging ? 'none' : 'pan-y', H = Math.max(560, bottom + 120);

  return <>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span role="status" style={{ flex: 1, fontSize: 13, color: arranging ? 'var(--ac)' : 'var(--mu)' }}>{arranging ? 'Drag notes anywhere · tap Done to finish'
        : narrow ? 'Tap a note to open it · press and hold to drag.' : 'Marked words stay on top, even when notes cover each other. Drag to move (press and hold on touch), click to open.'}</span>
      <button className="h-ac" onClick={() => { setDragPos(null); void shuffle(); }} style={{ ...smallBtn, padding: '6px 14px', background: 'var(--sf)' }}>Shuffle</button>
      {narrow && <button className="h-ac" aria-pressed={arranging} onClick={() => setArrange(a => !a)}
        style={{ ...smallBtn, padding: '6px 14px', background: arranging ? 'var(--ac)' : 'var(--sf)', color: arranging ? 'var(--bg)' : 'var(--ink)', borderColor: arranging ? 'var(--ac)' : 'var(--ln)' }}>{arranging ? 'Done' : 'Arrange'}</button>}
    </div>
    <div ref={boardRef} style={{ position: 'relative', isolation: 'isolate', borderRadius: narrow ? 0 : 16, background: cfg.concept === 'sticky' ? (dark ? '#2A241F' : '#D9CDB8') : 'var(--sf2)',
      // Phones: edge to edge, with room below the last card for the bottom nav and the home indicator.
      height: narrow ? `calc(${H}px + ${navShown ? NAV_H : 0}px + env(safe-area-inset-bottom))` : H, margin: narrow ? `0 -${bleed}px` : 0,
      border: '1px solid var(--ln)', borderLeftWidth: narrow ? 0 : 1, borderRightWidth: narrow ? 0 : 1, outline: arranging ? '1.5px solid var(--ac)' : 'none', outlineOffset: -1.5,
      overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none' }}>
      {cards.map(({ r, at, rot, z: zi, L }) => { const picks = picksFor(r, marks);
        return <div key={r.n.id} data-cid={r.n.id} data-rot={rot} role="button" tabIndex={0} aria-label={r.n.title || 'Untitled'}
          onPointerDown={e => down(e, r.n.id, at)} onContextMenu={noMenu} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); useStore.getState().openNote(r.n.id); } }}
          style={{ position: 'absolute', left: at.x, top: at.y, width: cw, zIndex: zi, padding: '20px 18px 16px', minHeight: cfg.concept === 'sticky' ? Math.round(cw * 0.8) : 0,
            border: '1px solid ' + L.border, borderRadius: L.radius, background: L.bg, color: L.ink, boxShadow: L.shadow, transform: `rotate(${rot}deg)`, opacity: r.ok ? 1 : .4,
            cursor: 'grab', touchAction: ta, WebkitTouchCallout: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {L.tape && <span aria-hidden="true" style={{ position: 'absolute', top: -9, left: 'calc(50% - 30px)', width: 60, height: 18, background: L.tape, transform: `rotate(${L.tapeRot}deg)`, borderRadius: 1 }} />}
          <span style={{ display: 'flex', gap: 8, fontFamily: MONO, fontSize: 10, letterSpacing: '.05em', textTransform: 'uppercase', color: L.mu }}>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.n.title || 'Untitled'}</span><span>{fmt(r.n.ts)}</span>
          </span>
          {picks.map((segs, i) => <span key={i} style={{ display: 'block', fontFamily: SERIF, fontSize: picks.length > 2 ? 15 : 17, lineHeight: 1.45, overflowWrap: 'anywhere' }}>
            <Highlighted segs={segs} concept={cfg.concept} dark={L.dark} />
          </span>)}
        </div>; })}
      {ghosts.map((g, i) => { const k = byId[g.id]; return <span key={i} aria-hidden="true" onPointerDown={e => k && down(e, g.id, k.at)} onContextMenu={noMenu}
        style={{ position: 'absolute', left: g.x, top: g.y, transform: `translate(-50%,-50%) rotate(${g.rot}deg)`, zIndex: 9500, opacity: k && !k.r.ok ? .4 : 1, whiteSpace: 'nowrap', fontFamily: SERIF, fontSize: g.fs, lineHeight: 1.45,
          fontWeight: 700, color: g.ink, background: g.bg, boxShadow: (g.sh && g.sh !== 'none' ? g.sh + ', ' : '') + '0 3px 10px rgba(0,0,0,.25)', borderRadius: 3, padding: '0 2px', cursor: 'grab', touchAction: ta, WebkitTouchCallout: 'none' }}>{g.t}</span>; })}
    </div>
  </>;
}
