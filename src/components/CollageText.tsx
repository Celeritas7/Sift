import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useStore } from '../state/store';
import { useNotes, useOwnHighlights, usePalette, type NoteV } from '../state/derived';
import { hitLine, hl, inputKey, isLive, look, marker, matchNote, matchText, mkBg, mkLine, paragraphs, passes, segments, type NoteMatch, type Seg } from '../lib/collage';
import { ownColor, type Anchored } from '../lib/highlights';
import { plural } from '../lib/format';
import type { CollageSettings } from '../types';

/** Inline style of one highlight segment: marks are solid chips; own highlights and sentence matches a marker stroke. */
export function segStyle(g: Seg, concept: CollageSettings['concept'], dark: boolean): CSSProperties {
  if (g.kind === 'mark') return { background: mkBg(g.ci, dark), fontWeight: 700, boxShadow: 'inset 0 -2px 0 ' + mkLine(g.ci), borderRadius: 3, padding: '0 2px', whiteSpace: 'nowrap' };
  if (g.kind === 'own') return { background: marker(ownColor(g.color, dark)), mixBlendMode: dark ? 'normal' : 'multiply', padding: '0 2px', boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' };
  if (g.kind === 'hl') return { background: marker(hl(g.pi, concept, dark)), mixBlendMode: concept === 'sticky' ? 'multiply' : 'normal', padding: '0 2px', boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' };
  return {};
}

/** Renders segments losslessly: the text content equals the source text, so DOM offsets map back to string offsets. */
export function Highlighted({ segs, concept = 'marker', dark }: { segs: Seg[]; concept?: CollageSettings['concept']; dark: boolean }) {
  return <>{segs.map((g, i) => g.kind === 'plain' ? <span key={i}>{g.t}</span>
    : <span key={i} data-mk={g.kind === 'mark' ? '1' : undefined} style={segStyle(g, concept, dark)}>{g.t}</span>)}</>;
}

export function useDebounced<T>(v: T, ms: number) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

export interface CollageRow { n: NoteV; m: NoteMatch; own: Anchored[]; ok: boolean; }
const NONE: Anchored[] = [];

/** Visible notes matched against the writing pad (debounced 150 ms), passing notes first → score → newest. Notes with own highlights always pass. */
export function useCollageRows() {
  const { active, lockedCount } = useNotes(); const ownBy = useOwnHighlights();
  const pad = useStore(s => s.collage.pad), marksNow = useStore(s => s.collage.marks), muted = useStore(s => s.collage.muted), minWords = useStore(s => s.collage.minWords);
  const input = useDebounced(useMemo(() => ({ pad, marks: marksNow, muted, minWords }), [pad, marksNow, muted, minWords]), 150);
  const paras = useMemo(() => paragraphs(input.pad, input.muted), [input]);
  const key = useMemo(() => inputKey(paras, input.marks, input.minWords), [paras, input.marks, input.minWords]);
  const live = isLive(paras, input.marks);
  const rows = useMemo(() => active.filter(n => !n.hidden).map((n): CollageRow => {
    const m = matchNote(n, paras, input.marks, input.minWords, key), own = ownBy[n.id] ?? NONE; return { n, m, own, ok: passes(m, live) || own.length > 0 }; })
    .sort((a, b) => (+b.ok - +a.ok) || b.m.score - a.m.score || b.n.ts - a.n.ts), [active, key, ownBy]);
  return { rows, paras, marks: input.marks, live, lockedCount };
}

/** Note sheet opened from Collage: the card's colours, the highlighted body and the hit summary. */
export function useCollageSheet(n: NoteV | null, own: Anchored[]) {
  const cfg = useStore(s => s.collage); const { c, dark } = usePalette();
  return useMemo(() => {
    if (!n) return null;
    const paras = paragraphs(cfg.pad, cfg.muted), live = isLive(paras, cfg.marks), m = matchText(n.body, paras, cfg.marks, cfg.minWords), L = look(n.id, n.topic, cfg, c, dark);
    const parts = [live ? hitLine(m, cfg.marks) : '', own.length ? plural(own.length, 'highlight') + ' of yours' : ''].filter(Boolean);
    return { look: L, concept: cfg.concept, segs: segments(n.body, m.sents, m.mrs, cfg.marks, own),
      line: parts.join(' · ') || (live ? 'Nothing here matches your writing.' : 'Nothing written yet.') };
  }, [n, own, cfg, c, dark]);
}
