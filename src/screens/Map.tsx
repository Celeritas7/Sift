import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { suggestFor, useIndex, useIsMobile, useNotes, usePalette } from '../state/derived';
import { layoutMap, SIM_MIN, SIM_NEW } from '../similarity';
import { MAP_MAX_NODES, MONO, SERIF, TOPICS, topicColor, topicName } from '../lib/config';
import { captureNote } from '../lib/capture';
import { H1, Lede } from '../components/ui';

export function MapView() {
  const st = useStore(); const m = st.map; const { c, dark } = usePalette(); const mobile = useIsMobile();
  const { open, lockedCount } = useNotes(); const index = useIndex();
  const [draft, setDraft] = useState(''); const [drag, setDrag] = useState<Record<string, { x: number; y: number }>>({});
  const ref = useRef<HTMLElement>(null); const posRef = useRef<Record<string, { x: number; y: number }>>({});
  const notes = open.slice(0, MAP_MAX_NODES);
  const idsKey = notes.map(n => n.id + n.topic).join('|');

  // Polar seed + 60 relaxation passes (ported exactly), then user positions on top.
  const base = useMemo(() => layoutMap(notes.map(n => ({ id: n.id, topic: n.topic, ts: n.ts })), TOPICS.map(t => t.id as string)), [idsKey]);
  const pos = useMemo(() => { const p: Record<string, { x: number; y: number; flip: boolean }> = {};
    Object.entries(base).forEach(([k, v]) => { const o = drag[k] || st.layout.map[k]; p[k] = o ? { ...v, x: o.x, y: o.y } : v; }); return p; }, [base, drag, st.layout.map]);
  posRef.current = pos;

  const thr = (a: string, b: string) => (st.sessionNew[a] || st.sessionNew[b] ? SIM_NEW : SIM_MIN);
  const links = useMemo(() => { const out: { a: string; b: string; sim: number }[] = [];
    for (let i = 0; i < notes.length; i++) for (let j = i + 1; j < notes.length; j++) { const a = notes[i].id, b = notes[j].id, sim = index.sim(a, b); if (sim > thr(a, b)) out.push({ a, b, sim }); }
    return out; }, [index, idsKey, st.sessionNew]);
  const neighbours = useMemo(() => { const s = new Set<string>(); if (m.hover) links.forEach(l => { if (l.a === m.hover) s.add(l.b); if (l.b === m.hover) s.add(l.a); }); return s; }, [links, m.hover]);
  const topicOf = useMemo(() => Object.fromEntries(notes.map(n => [n.id, n.topic])), [idsKey]);

  useEffect(() => { const el = ref.current; if (!el) return;
    const wheel = (e: WheelEvent) => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); const z = useStore.getState().map.zoom; st.setMap({ zoom: Math.min(2.5, Math.max(0.6, z * (e.deltaY < 0 ? 1.08 : 1 / 1.08))) }); };
    el.addEventListener('wheel', wheel, { passive: false }); return () => el.removeEventListener('wheel', wheel); }, []);

  const nodeDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation(); if (e.button > 0 || !ref.current) return;
    const r = ref.current.getBoundingClientRect(), z = m.zoom, b = { ...(posRef.current[id] || { x: 50, y: 31.25 }) }, sx = e.clientX, sy = e.clientY; let moved = false, last = b;
    const mv = (ev: PointerEvent) => { const dx = ev.clientX - sx, dy = ev.clientY - sy; if (!moved && Math.hypot(dx, dy) < 4) return; moved = true;
      last = { x: Math.min(97, Math.max(3, b.x + dx / (r.width * z) * 100)), y: Math.min(60, Math.max(2.5, b.y + dy / (r.height * z) * 62.5)) };
      st.setMap({ dragging: id }); setDrag(d => ({ ...d, [id]: last })); };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); st.setMap({ dragging: null });
      if (moved) void st.setLayout('map', id, last.x, last.y).then(() => setDrag(d => { const { [id]: _, ...rest } = d; return rest; })); else st.openNote(id); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  };
  const bgDown = (e: React.PointerEvent) => { if (e.button > 0) return; const sx = e.clientX, sy = e.clientY, b = { ...m.pan };
    const mv = (ev: PointerEvent) => st.setMap({ dragging: 'bg', pan: { x: b.x + ev.clientX - sx, y: b.y + ev.clientY - sy } });
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); st.setMap({ dragging: null }); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); };

  const draftOn = draft.trim().length >= 4; const g = draftOn ? suggestFor(index, open, draft) : { topic: null, related: [] };
  const ghostEdges = g.related.filter(x => pos[x.n.id]);
  const placed = m.placed ? open.find(n => n.id === m.placed) : null;
  const pRel = placed ? open.filter(n => n.id !== placed.id).map(n => ({ n, sim: index.sim(placed.id, n.id) })).filter(x => x.sim > SIM_NEW).sort((a, b) => b.sim - a.sim).slice(0, 2) : [];
  const place = async (e: React.FormEvent) => { e.preventDefault(); const r = await captureNote(draft, {}, index, open); if (!r) return;
    const linked = suggestFor(index, open, r.note.body).related.length > 0; setDraft(''); st.setMap({ placed: r.note.id, hover: linked ? r.note.id : null });
    setTimeout(() => { if (useStore.getState().map.hover === r.note.id) st.setMap({ hover: null }); }, 3500); };
  const edited = Object.keys(st.layout.map).length > 0 || Math.abs(m.zoom - 1) > 0.01 || m.pan.x !== 0 || m.pan.y !== 0;
  const stop = (e: React.PointerEvent) => e.stopPropagation();
  const newest = [...open].filter(n => st.sessionNew[n.id]).sort((a, b) => b.ts - a.ts)[0]?.id;

  return <>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <H1>What's near what</H1>
        <Lede>Colour is topic, lines are relevance. Drag notes to rearrange, drag the background to pan, ⌘/Ctrl-scroll or the buttons to zoom. Tap a topic below to highlight it.</Lede>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '0 1 380px', minWidth: 0 }}>
        <form onSubmit={place} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px 8px 14px', border: '1px solid var(--ac)', borderRadius: 999, background: 'var(--sf)' }}>
          <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Drop a thought onto the map" aria-label="Place a thought" style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', outline: 'none', fontFamily: SERIF, fontSize: 15 }} />
          <button type="submit" style={{ padding: '6px 12px', border: 0, borderRadius: 999, background: 'var(--ac)', color: 'var(--acink)', fontSize: 12, opacity: draft.trim() ? 1 : .45 }}>Place</button>
        </form>
        <span style={{ fontSize: 12, color: 'var(--mu)', paddingLeft: 14 }}>{draftOn ? (g.topic ? 'Will join ' + topicName(g.topic) + (g.related.length ? ' · near ' + g.related.slice(0, 2).map(x => x.n.title).join(', ') : '') : 'No close match yet. It will land in Scraps.') : 'Becomes a new note. Sift picks the topic and draws its links.'}</span>
      </div>
    </div>
    {placed && <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 16px', borderRadius: 14, background: 'var(--acs)', animation: 'siftin .2s ease-out' }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: topicColor(placed.topic, dark), boxShadow: '0 0 0 4px var(--sf)' }} />
      <span style={{ fontSize: 14, flex: 1, minWidth: 0 }}>Placed as a new note in {topicName(placed.topic)}. {pRel.length ? 'Linked to ' + pRel.map(x => x.n.title + ' (' + Math.round(x.sim * 100) + '%)').join(' and ') + '.' : 'No strong links yet. Add more detail to connect it.'}</span>
      <button onClick={() => st.openNote(placed.id)} style={{ padding: '5px 12px', border: 0, borderRadius: 999, background: 'var(--ink)', color: 'var(--bg)', fontSize: 12 }}>Open note</button>
      <button onClick={() => void st.removeNote(placed.id)} style={{ padding: '5px 10px', border: 0, borderRadius: 999, background: 'transparent', color: 'var(--ac)', fontSize: 12 }}>Undo</button>
    </div>}
    <section ref={ref} onPointerDown={bgDown} style={{ position: 'relative', width: '100%', aspectRatio: mobile ? '1/1.1' : '16/9', maxHeight: 620, border: '1px solid var(--ln)', borderRadius: 18, background: 'var(--sf)', overflow: 'hidden', cursor: m.dragging === 'bg' ? 'grabbing' : 'grab', touchAction: 'none', userSelect: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `translate(${m.pan.x}px,${m.pan.y}px) scale(${m.zoom})`, transformOrigin: '50% 50%', transition: m.dragging ? 'none' : 'transform .25s ease-out' }}>
        <svg viewBox="0 0 100 62.5" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
          {draftOn && ghostEdges.map(x => <line key={x.n.id} x1="50" y1="31.25" x2={pos[x.n.id].x} y2={pos[x.n.id].y} style={{ stroke: 'var(--ac)', strokeWidth: '1.5px', strokeDasharray: '4 4', opacity: .8, vectorEffect: 'non-scaling-stroke' }} />)}
          {links.map(l => { const touch = m.hover && (m.hover === l.a || m.hover === l.b);
            const op = m.hover ? (touch ? .95 : .06) : m.topic ? (topicOf[l.a] === m.topic || topicOf[l.b] === m.topic ? .85 : .05) : .25 + l.sim * .6;
            return <line key={l.a + l.b} x1={pos[l.a].x} y1={pos[l.a].y} x2={pos[l.b].x} y2={pos[l.b].y} style={{ stroke: 'var(--ac)', strokeWidth: 1 + l.sim * 6 + 'px', strokeLinecap: 'round', opacity: op, vectorEffect: 'non-scaling-stroke', transition: 'opacity .2s' }} />; })}
        </svg>
        {notes.map(n => { const p = pos[n.id]; const hov = m.hover === n.id; const linked = !m.hover || hov || neighbours.has(n.id);
          const op = linked && (!m.topic || n.topic === m.topic || hov) ? 1 : m.hover ? .3 : .2;
          return <button key={n.id} onPointerDown={e => nodeDown(e, n.id)} onMouseEnter={() => st.setMap({ hover: n.id })} onMouseLeave={() => st.setMap({ hover: null })}
            style={{ position: 'absolute', left: p.x + '%', top: p.y / 62.5 * 100 + '%', transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: p.flip ? 'column-reverse' : 'column', alignItems: 'center', gap: 5, border: 0, background: 'transparent', padding: 6, opacity: op, transition: 'opacity .2s', cursor: m.dragging === n.id ? 'grabbing' : 'grab', touchAction: 'none', zIndex: m.dragging === n.id || hov ? 5 : 1 }}>
            <span style={{ width: hov ? 16 : n.pinned ? 13 : 10, height: hov ? 16 : n.pinned ? 13 : 10, borderRadius: '50%', background: topicColor(n.topic, dark), boxShadow: '0 0 0 3px var(--sf),' + (n.id === newest ? '0 0 0 6px ' + c.acs : '0 0 0 0 transparent'), transition: 'width .15s,height .15s' }} />
            <span style={{ fontSize: 11, fontWeight: hov ? 600 : 400, maxWidth: mobile ? 80 : 120, whiteSpace: 'normal', lineHeight: 1.2, textAlign: 'center', padding: '1px 4px', textShadow: '0 0 6px var(--sf),0 0 2px var(--sf)' }}>{n.title || 'Untitled'}</span>
          </button>; })}
        {draftOn && <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, pointerEvents: 'none', animation: 'siftin .2s ease-out' }}>
          <span style={{ width: 18, height: 18, borderRadius: '50%', border: `2px dashed ${g.topic ? topicColor(g.topic, dark) : c.mu}`, background: 'var(--sf)', animation: 'siftpulse 1.4s ease-in-out infinite' }} />
          <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, background: 'var(--ink)', color: 'var(--bg)', whiteSpace: 'nowrap' }}>{topicName(g.topic)}</span>
        </div>}
      </div>
      <div onPointerDown={stop} style={{ position: 'absolute', top: 12, right: 12, display: 'flex', alignItems: 'center', gap: 2, padding: 3, border: '1px solid var(--ln)', borderRadius: 999, background: 'var(--sf)', cursor: 'default' }}>
        <button className="h-sf2" onClick={() => st.setMap({ zoom: Math.max(0.6, m.zoom / 1.2) })} aria-label="Zoom out" style={{ width: 28, height: 28, border: 0, borderRadius: '50%', background: 'transparent', fontSize: 16, lineHeight: 1 }}>−</button>
        <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--mu)', minWidth: 40, textAlign: 'center' }}>{Math.round(m.zoom * 100)}%</span>
        <button className="h-sf2" onClick={() => st.setMap({ zoom: Math.min(2.5, m.zoom * 1.2) })} aria-label="Zoom in" style={{ width: 28, height: 28, border: 0, borderRadius: '50%', background: 'transparent', fontSize: 16, lineHeight: 1 }}>+</button>
        {edited && <button onClick={() => void st.resetLayout('map')} style={{ height: 28, padding: '0 10px', border: 0, borderLeft: '1px solid var(--ln)', background: 'transparent', fontSize: 12, color: 'var(--ac)' }}>Reset</button>}
      </div>
      {m.topic && <div onPointerDown={stop} style={{ position: 'absolute', top: 12, left: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px 5px 12px', borderRadius: 999, background: 'var(--ink)', color: 'var(--bg)', fontSize: 12, cursor: 'default', animation: 'siftin .15s ease-out' }}>
        <span>Only {topicName(m.topic)}</span>
        <button onClick={() => st.set({ filter: m.topic!, view: 'stream', selId: null, query: '' })} style={{ border: 0, borderRadius: 999, background: 'var(--bg)', color: 'var(--ink)', fontSize: 11, padding: '3px 9px' }}>Show in stream</button>
        <button onClick={() => st.setMap({ topic: null })} aria-label="Clear topic" style={{ border: 0, background: 'transparent', color: 'var(--bg)', fontSize: 14, lineHeight: 1, padding: '0 4px' }}>×</button>
      </div>}
      <div onPointerDown={stop} style={{ position: 'absolute', left: 14, right: 14, bottom: 12, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', cursor: 'default' }}>
        {TOPICS.map(t => { const on = m.topic === t.id; return <button key={t.id} className="h-ac" onClick={() => st.setMap({ topic: on ? null : t.id })}
          style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${on ? c.ac : c.ln}`, borderRadius: 999, background: on ? c.acs : c.sf, padding: '3px 9px', fontSize: 11, fontWeight: on ? 600 : 400, color: 'var(--ink)', opacity: !m.topic || on ? 1 : .45, transition: 'opacity .2s' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: topicColor(t.id, dark) }} />{t.name}</button>; })}
        <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 10, color: 'var(--mu)' }}>
          {lockedCount && !st.unlocked ? lockedCount + ' vault notes hidden · ' : ''}{open.length > MAP_MAX_NODES ? `newest ${MAP_MAX_NODES} of ${open.length} · ` : ''}centre = newest · line = similarity</span>
      </div>
    </section>
  </>;
}
