import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useStore } from '../state/store';
import { useNotes, usePalette, type NoteV } from '../state/derived';
import { hitLine, hl, inputKey, isLive, look, marker, matchNote, matchText, mkBg, mkLine, paragraphs, passes, segments, type NoteMatch, type Seg } from '../lib/collage';
import type { CollageSettings } from '../types';

/** Inline style of one highlight segment: marks are solid chips, sentences a marker stroke. */
export function segStyle(g: Seg, concept: CollageSettings['concept'], dark: boolean): CSSProperties {
  if (g.kind === 'mark') return { background: mkBg(g.ci, dark), fontWeight: 700, boxShadow: 'inset 0 -2px 0 ' + mkLine(g.ci), borderRadius: 3, padding: '0 2px', whiteSpace: 'nowrap' };
  if (g.kind === 'hl') return { background: marker(hl(g.pi, concept, dark)), mixBlendMode: concept === 'sticky' ? 'multiply' : 'normal', padding: '0 2px', boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' };
  return {};
}

export function Highlighted({ segs, concept, dark }: { segs: Seg[]; concept: CollageSettings['concept']; dark: boolean }) {
  return <>{segs.map((g, i) => g.kind === 'plain' ? <span key={i}>{g.t}</span>
    : <span key={i} data-mk={g.kind === 'mark' ? '1' : undefined} style={segStyle(g, concept, dark)}>{g.t}</span>)}</>;
}

export function useDebounced<T>(v: T, ms: number) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

export interface CollageRow { n: NoteV; m: NoteMatch; ok: boolean; }

/** Visible notes matched against the writing pad (debounced 150 ms), passing notes first → score → newest. */
export function useCollageRows() {
  const { active, lockedCount } = useNotes();
  const pad = useStore(s => s.collage.pad), marksNow = useStore(s => s.collage.marks), muted = useStore(s => s.collage.muted);
  const input = useDebounced(useMemo(() => ({ pad, marks: marksNow, muted }), [pad, marksNow, muted]), 150);
  const paras = useMemo(() => paragraphs(input.pad, input.muted), [input]);
  const key = useMemo(() => inputKey(paras, input.marks), [paras, input.marks]);
  const live = isLive(paras, input.marks);
  const rows = useMemo(() => active.filter(n => !n.hidden).map((n): CollageRow => { const m = matchNote(n, paras, input.marks, key); return { n, m, ok: passes(m, live) }; })
    .sort((a, b) => (+b.ok - +a.ok) || b.m.score - a.m.score || b.n.ts - a.n.ts), [active, key]);
  return { rows, paras, marks: input.marks, live, lockedCount };
}

/** Note sheet opened from Collage: the card's colours, the highlighted body and the hit summary. */
export function useCollageSheet(n: NoteV | null) {
  const cfg = useStore(s => s.collage); const { c, dark } = usePalette();
  return useMemo(() => {
    if (!n) return null;
    const paras = paragraphs(cfg.pad, cfg.muted), live = isLive(paras, cfg.marks), m = matchText(n.body, paras, cfg.marks), L = look(n.id, n.topic, cfg, c, dark);
    return { look: L, concept: cfg.concept, segs: segments(n.body, m.sents, m.mrs, cfg.marks),
      line: live ? (hitLine(m, cfg.marks) || 'Nothing here matches your writing.') : 'Nothing written yet.' };
  }, [n, cfg, c, dark]);
}
