import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../state/store';
import { usePalette } from '../state/derived';
import { HL_COLORS, type Anchored } from '../lib/highlights';
import type { HighlightColor } from '../types';

interface Sel { s: number; e: number; x: number; y: number; inside: Anchored | null; }

/** A note body whose text can be highlighted: selecting text shows a floating toolbar with the 4 highlighter colours,
 *  plus "Remove" when the selection sits inside one of the user's highlights. Children must render `text` losslessly. */
export function HighlightableBody({ noteId, text, own, style, children }: { noteId: string; text: string; own: Anchored[]; style?: CSSProperties; children: ReactNode }) {
  const addHighlight = useStore(s => s.addHighlight), removeHighlight = useStore(s => s.removeHighlight); const { c } = usePalette();
  const ref = useRef<HTMLDivElement>(null); const [sel, setSel] = useState<Sel | null>(null);
  const live = useRef({ text, own }); live.current = { text, own };

  useEffect(() => {
    const update = () => {
      const el = ref.current, ws = window.getSelection();
      if (!el || !ws || !ws.rangeCount || ws.isCollapsed) { setSel(null); return; }
      const r = ws.getRangeAt(0); if (!el.contains(r.startContainer) || !el.contains(r.endContainer)) { setSel(null); return; }
      const off = (node: Node, o: number) => { const x = document.createRange(); x.setStart(el, 0); x.setEnd(node, o); return x.toString().length; };
      const { text: t, own: o } = live.current; let s = off(r.startContainer, r.startOffset), e = off(r.endContainer, r.endOffset);
      while (s < e && /\s/.test(t[s])) s++; while (e > s && /\s/.test(t[e - 1])) e--;
      if (e <= s) { setSel(null); return; }
      const rect = r.getBoundingClientRect();
      setSel({ s, e, x: rect.left + rect.width / 2, y: rect.top > 54 ? rect.top - 46 : rect.bottom + 8, inside: o.find(h => h.s <= s && e <= h.e) ?? null });
    };
    document.addEventListener('selectionchange', update); window.addEventListener('scroll', update, true); window.addEventListener('resize', update);
    return () => { document.removeEventListener('selectionchange', update); window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); };
  }, []);

  const done = () => { window.getSelection()?.removeAllRanges(); setSel(null); };
  const pick = (color: HighlightColor) => { if (sel) void addHighlight(noteId, sel.s, sel.e, color); done(); };
  const keep = (e: React.PointerEvent | React.MouseEvent) => e.preventDefault(); // keep the text selection while clicking the toolbar

  return <>
    <div ref={ref} style={style}>{children}</div>
    {sel && createPortal(<div role="toolbar" aria-label="Highlight selection" onPointerDown={keep} onMouseDown={keep}
      style={{ position: 'fixed', left: sel.x, top: sel.y, transform: 'translateX(-50%)', zIndex: 70, display: 'flex', alignItems: 'center', gap: 6, padding: 6,
        borderRadius: 999, background: c.ink, color: c.bg, boxShadow: '0 8px 24px rgba(0,0,0,.25)', animation: 'siftin .12s ease-out' }}>
      {HL_COLORS.map((k, i) => { const on = sel.inside?.color === k.id; return <button key={k.id} title={k.label + (i === 0 ? ' (default)' : '')} aria-label={'Highlight in ' + k.label.toLowerCase()} aria-pressed={on}
        onClick={() => pick(k.id)} style={{ width: 24, height: 24, borderRadius: '50%', padding: 0, border: 0, background: k.light, boxShadow: on ? `0 0 0 2px ${c.ink}, 0 0 0 4px ${c.bg}` : 'none' }} />; })}
      {sel.inside && <button onClick={() => { void removeHighlight(sel.inside!.id); done(); }} style={{ marginLeft: 2, padding: '3px 10px', border: 0, borderLeft: `1px solid ${c.mu}`, background: 'transparent', color: c.bg, fontSize: 12 }}>Remove</button>}
    </div>, document.body)}
  </>;
}
