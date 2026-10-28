import { useMemo, useRef, useState, type PointerEvent as RPE } from 'react';
import { useStore } from '../state/store';
import { noteText, useIsMobile, useNotes, usePalette, useTick } from '../state/derived';
import { mentionIndex } from '../lib/mentions';
import { useWfStats } from '../state/counts';
import { boardMeta } from '../lib/wf';
import { cloud } from '../lib/supabase';
import { MONO, SERIF } from '../lib/config';
import { plural } from '../lib/format';
import { Check, Eyebrow, H1, Lede } from '../components/ui';

type Drag = { from: string; id: string; t: string; x: number; y: number; x0: number; y0: number; moved: boolean; over: string | null };

/** Drag a task by its handle onto another item; a tap on the handle opens a "Move to" list instead. */
function useTaskDrag(onDrop: (from: string, id: string, to: string) => void) {
  const [drag, setDrag] = useState<Drag | null>(null); const [menu, setMenu] = useState<string | null>(null); const scrollT = useRef(0);
  const overAt = (x: number, y: number) => (document.elementFromPoint(x, y)?.closest('[data-wf-item]') as HTMLElement | null)?.dataset.wfItem ?? null;
  const stopScroll = () => { cancelAnimationFrame(scrollT.current); scrollT.current = 0; };
  const handle = (from: string, id: string, t: string) => ({
    onPointerDown: (e: RPE<HTMLButtonElement>) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setDrag({ from, id, t, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, moved: false, over: from }); },
    onPointerMove: (e: RPE<HTMLButtonElement>) => setDrag(d => {
      if (!d || d.id !== id) return d; const moved = d.moved || Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 6; if (!moved) return d;
      // Near the top or bottom edge the page scrolls, so a task can travel to a card off screen (phones stack the cards).
      const edge = e.clientY < 70 ? -1 : e.clientY > innerHeight - 140 ? 1 : 0; stopScroll();
      if (edge) { const step = () => { scrollBy(0, edge * 12); scrollT.current = requestAnimationFrame(step); }; scrollT.current = requestAnimationFrame(step); }
      return { ...d, x: e.clientX, y: e.clientY, moved, over: overAt(e.clientX, e.clientY) };
    }),
    onPointerUp: (e: RPE<HTMLButtonElement>) => { e.stopPropagation(); stopScroll(); const d = drag; setDrag(null); if (!d) return;
      if (!d.moved) { setMenu(m => (m === id ? null : id)); return; }
      const to = overAt(e.clientX, e.clientY); if (to && to !== d.from) onDrop(d.from, d.id, to); },
    onPointerCancel: () => { stopScroll(); setDrag(null); },
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
  });
  return { drag, menu, setMenu, handle };
}

export function Week() {
  useTick(1000);
  const st = useStore(); const { c } = usePalette(); const mobile = useIsMobile(); const wf = useWfStats(); const { byId, open } = useNotes();
  const find = useMemo(() => mentionIndex(open.map(n => ({ id: n.id, text: noteText(n), ts: n.ts }))), [open]);
  const [shown, setShown] = useState<string | null>(null);
  const { drag, menu, setMenu, handle } = useTaskDrag((from, id, to) => { setMenu(null); void st.moveWfSubtask(from, id, to); });
  const meta = boardMeta(Object.values(st.wf)); const syncAgo = Math.round((Date.now() - st.wfSyncedAt) / 1000);
  const syncLabel = !cloud ? 'Local sample board' : st.pending ? `${st.pending} change${st.pending === 1 ? '' : 's'} waiting to sync` : syncAgo < 5 ? 'Synced just now' : `Synced ${syncAgo}s ago`;
  return <>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Eyebrow><span>Weekly Focus · my_week</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, textTransform: 'none', letterSpacing: 0, padding: '2px 8px', borderRadius: 999, background: 'var(--acs)', color: 'var(--ac)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ac)', animation: 'siftpulse 2s ease-in-out infinite' }} />{syncLabel}</span>
      </Eyebrow>
      <H1>{wf.done} of {wf.total} tasks done</H1>
      <Lede max={60}>Two-way: tick here or in Weekly Focus and both update. Tasks sent from a note keep a link back to it. {wf.parked ? plural(wf.parked, 'parked task is', 'parked tasks are') + ' hidden.' : ''}</Lede>
    </div>
    {!wf.items.length && <p style={{ margin: 0, fontFamily: SERIF, fontSize: 24, fontWeight: 300, fontStyle: 'italic', color: 'var(--mu)' }}>No Weekly Focus board found for my_week.</p>}
    <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(auto-fit,minmax(280px,1fr))', gap: 14, alignItems: 'start' }}>
      {wf.items.map(it => {
        const subs = it.payload.subtasks.filter(s => !s.del && !s.lat); const dn = subs.filter(s => s.done).length;
        const target = !!drag?.moved && drag.over === it.item_key && drag.from !== it.item_key;
        return <section key={it.item_key} data-wf-item={it.item_key} style={{ display: 'flex', flexDirection: 'column', border: `1px solid ${target ? c.ac : c.ln}`, boxShadow: target ? `0 0 0 3px ${c.acs}` : 'none', borderRadius: 16, background: 'var(--sf)', overflow: 'hidden', transition: 'border-color .15s, box-shadow .15s' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '16px 18px', borderBottom: '1px solid var(--ln)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontFamily: MONO, fontSize: 11, color: 'var(--mu)' }}><span style={{ color: 'var(--ac)' }}>{it.item_key}</span><span>P{it.payload.pri} · {dn}/{subs.length}</span></div>
            <h3 style={{ margin: 0, fontFamily: SERIF, fontSize: 20, fontWeight: 400, letterSpacing: '-.01em' }}>{it.payload.objective}</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', padding: '4px 8px 8px' }}>
            {subs.map(s => {
              const nid = (s.src || '').startsWith('sift:') ? s.src!.slice(5).split('#')[0] : null; const note = nid ? byId[nid] : null;
              const badges = [
                ...(s.when ? [{ t: new Date(s.when + 'T00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }), bg: c.sf2, color: c.mu }] : []),
                { t: s.md === 'o' ? 'office' : s.md === 'b' ? 'both' : 'personal', bg: c.sf2, color: c.mu },
                ...(s.urg ? [{ t: 'urgent', bg: c.ac, color: c.acink }] : []), ...(s.dl ? [{ t: 'deadline', bg: c.acs, color: c.ac }] : []),
                ...(s.ctx || []).map(x => ({ t: x, bg: 'transparent', color: c.mu })),
              ];
              const hits = find(s.t, nid); const others = wf.items.filter(o => o.item_key !== it.item_key);
              const lifted = drag?.moved && drag.id === s.id;
              return <div key={s.id} className="h-sf2" onClick={() => void st.toggleWfSubtask(it.item_key, s.id)} style={{ display: 'grid', gridTemplateColumns: '22px 1fr 32px', gap: 10, padding: '10px 4px 10px 10px', borderRadius: 10, cursor: 'pointer', opacity: lifted ? .35 : 1 }}>
                <Check done={s.done} size={18} font={10} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
                  <span style={{ fontSize: 14, textDecoration: s.done ? 'line-through' : 'none', color: s.done ? c.mu : c.ink }}>{s.t}</span>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                    {badges.map((b, i) => <span key={i} style={{ fontFamily: MONO, fontSize: 10, padding: '1px 6px', borderRadius: 4, background: b.bg, color: b.color }}>{b.t}</span>)}
                    {nid && <button className="h-ul" onClick={e => { e.stopPropagation(); if (note) st.openNote(note.id); }} style={{ border: 0, background: 'transparent', padding: 0, fontSize: 11, color: 'var(--ac)' }}>
                      ↗ {note ? (note.hidden ? 'Locked note' : note.title || 'Untitled') : 'note'}</button>}
                    {hits.length > 0 && <button aria-expanded={shown === s.id} onClick={e => { e.stopPropagation(); setShown(shown === s.id ? null : s.id); }}
                      style={{ border: 0, background: 'transparent', padding: mobile ? '6px 2px' : 0, fontSize: 11, color: 'var(--mu)' }}>Mentioned in {plural(hits.length, 'note')} {shown === s.id ? '▴' : '▾'}</button>}
                  </div>
                  {shown === s.id && <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 2 }}>
                    {hits.map(h => <button key={h} className="h-ul" onClick={e => { e.stopPropagation(); st.openNote(h); }} style={{ border: 0, background: 'transparent', padding: mobile ? '6px 0' : '2px 0', textAlign: 'left', fontFamily: SERIF, fontSize: 14, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ color: 'var(--ac)' }}>↗</span> {byId[h]?.title || 'Untitled'}</button>)}
                  </div>}
                  {menu === s.id && others.length > 0 && <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingTop: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--mu)' }}>Move to</span>
                    {others.map(o => <button key={o.item_key} className="h-acc" onClick={() => { setMenu(null); void st.moveWfSubtask(it.item_key, s.id, o.item_key); }}
                      style={{ fontFamily: MONO, fontSize: 11, padding: mobile ? '8px 11px' : '3px 9px', border: '1px solid var(--ln)', borderRadius: 999, background: 'var(--bg)', color: 'var(--ac)' }}>{o.item_key}</button>)}
                  </div>}
                </div>
                {others.length > 0 && <button {...handle(it.item_key, s.id, s.t)} aria-label="Move task" title="Drag to another item, or tap to pick one"
                  style={{ alignSelf: 'start', width: 32, height: mobile ? 44 : 28, marginTop: mobile ? -10 : -4, border: 0, borderRadius: 8, background: 'transparent', color: 'var(--mu)', cursor: drag ? 'grabbing' : 'grab', touchAction: 'none', fontSize: 16, lineHeight: 1 }}>⠿</button>}
              </div>;
            })}
            {!subs.length && <p style={{ margin: '8px 10px', fontSize: 13, color: 'var(--mu)', fontStyle: 'italic' }}>All tasks here are parked.</p>}
          </div>
        </section>;
      })}
    </div>
    {drag?.moved && <div aria-hidden="true" style={{ position: 'fixed', left: drag.x, top: drag.y, transform: 'translate(-50%,-120%) rotate(-2deg)', zIndex: 90, pointerEvents: 'none', maxWidth: 260, padding: '8px 14px', borderRadius: 12, background: 'var(--ink)', color: 'var(--bg)', fontSize: 13, boxShadow: '0 14px 40px rgba(0,0,0,.25)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{drag.t}</div>}
    <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 14 }}>
      {([['Done last week', meta.eowDone], ['Carried over', meta.eowCarry]] as const).map(([k, v]) =>
        <div key={k} style={{ padding: '16px 18px', borderRadius: 14, border: '1px dashed var(--ln)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--mu)' }}>{k}</span>
          <span style={{ fontFamily: SERIF, fontSize: 17 }}>{v || '—'}</span>
        </div>)}
    </div>
  </>;
}
