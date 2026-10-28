import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { commitAt, isHorizontal, SLOP, swipeAction } from '../lib/swipe';

/** Swipe right to pin/unpin, left to archive. Vertical drags stay page scrolls. */
export function SwipeRow({ pinned, onPin, onArchive, style, children }: { pinned: boolean; onPin(): void; onArchive(): void; style?: CSSProperties; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null); const g = useRef<{ x: number; y: number; id: number; mode: 'wait' | 'swipe' | 'scroll' } | null>(null);
  const swallow = useRef(false); const [dx, setDx] = useState(0); const [anim, setAnim] = useState(false);
  const w = () => box.current?.offsetWidth || 360;
  const end = (commit: boolean) => {
    const cur = g.current; g.current = null; if (!cur || cur.mode !== 'swipe') return;
    swallow.current = true; setTimeout(() => { swallow.current = false; }, 0);
    const act = commit ? swipeAction(dx, w()) : null; setAnim(true);
    if (act === 'archive') { setDx(-w()); setTimeout(onArchive, 180); } // slide out, then the row leaves the list
    else { setDx(0); if (act === 'pin') onPin(); }
  };
  const act = swipeAction(dx, w()); const far = Math.min(1, Math.abs(dx) / commitAt(w()));
  const label: CSSProperties = { fontFamily: 'inherit', fontSize: 12, fontWeight: 500, letterSpacing: '.04em', textTransform: 'uppercase', opacity: .4 + far * .6, transform: `scale(${act ? 1.08 : 1})`, transition: 'transform .15s' };
  return <div ref={box} style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', touchAction: 'pan-y', ...style }}
    onPointerDown={e => { if (e.pointerType === 'mouse') return; g.current = { x: e.clientX, y: e.clientY, id: e.pointerId, mode: 'wait' }; setAnim(false); }}
    onPointerMove={e => {
      const cur = g.current; if (!cur || cur.id !== e.pointerId || cur.mode === 'scroll') return;
      const mx = e.clientX - cur.x, my = e.clientY - cur.y;
      if (cur.mode === 'wait') {
        if (Math.abs(mx) < SLOP && Math.abs(my) < SLOP) return;
        if (!isHorizontal(mx, my)) { cur.mode = 'scroll'; return; }
        cur.mode = 'swipe'; box.current?.setPointerCapture(e.pointerId);
      }
      setDx(mx);
    }}
    onPointerUp={() => end(true)} onPointerCancel={() => end(false)}
    onClickCapture={e => { if (swallow.current) { e.stopPropagation(); e.preventDefault(); } }}>
    {dx !== 0 && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: dx > 0 ? 'flex-start' : 'flex-end', padding: '0 22px',
      background: act ? 'var(--ac)' : 'var(--sf2)', color: act ? 'var(--acink)' : 'var(--ink)', transition: 'background .15s' }}>
      <span style={label}>{dx > 0 ? (pinned ? 'Unpin' : 'Pin') : 'Archive'}</span>
    </div>}
    <div style={{ position: 'relative', transform: dx ? `translateX(${dx}px)` : undefined, transition: anim ? 'transform .18s ease-out' : 'none', background: dx ? 'var(--bg)' : undefined }}>{children}</div>
  </div>;
}
