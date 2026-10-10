import { useStore } from '../state/store';
import { useConflicts, useIndex, useIsMobile, useNotes, useOwnHighlights, usePalette } from '../state/derived';
import { SIM_RELATED } from '../similarity';
import { MONO, NO_AI, SANS, SERIF, topicColor } from '../lib/config';
import { fmtLong } from '../lib/format';
import { useImageUrl } from '../hooks/useImageUrl';
import { NoteChips } from '../screens/Stream';
import { Check, ghostBtn } from './ui';
import { Highlighted, useCollageSheet } from './CollageText';
import { HighlightableBody } from './HighlightToolbar';
import { segments } from '../lib/collage';
import type { Anchored } from '../lib/highlights';
import { useRef, type CSSProperties } from 'react';

const NONE: Anchored[] = [];

export function NoteSheet() {
  const st = useStore(); const { c, dark } = usePalette(); const mobile = useIsMobile(); const { byId, open } = useNotes(); const index = useIndex(); const conflicts = useConflicts();
  const n = st.selId ? byId[st.selId] : null; const img = useImageUrl(n?.image_path);
  const ownBy = useOwnHighlights(); const own = (n && ownBy[n.id]) || NONE;
  const coll = useCollageSheet(st.view === 'collage' && n && !n.hidden ? n : null, own);
  const downOnBackdrop = useRef(false);
  if (!n || n.hidden) return null;
  // From Collage the sheet takes the card's colours: rebind the theme variables inside the dialog.
  const L = coll?.look; const ink = L ? L.ink : c.ink, mu = L ? L.mu : c.mu;
  const tone: CSSProperties = L ? { '--sf': L.bg, '--ink': L.ink, '--mu': L.mu, '--ln': L.line, '--bg': `color-mix(in srgb, ${L.ink} 6%, ${L.bg})`, '--sf2': `color-mix(in srgb, ${L.ink} 10%, ${L.bg})`, color: L.ink } as CSSProperties : {};
  const related = open.filter(o => o.id !== n.id).map(o => ({ o, sim: index.sim(n.id, o.id) })).filter(x => x.sim > SIM_RELATED).sort((a, b) => b.sim - a.sim).slice(0, 3);
  const conflict = conflicts.some(p => p.a === n.id || p.b === n.id);
  const close = () => st.set({ selId: null });
  const toggleVault = () => { void st.updateNote(n.id, { vault: !n.vault }); if (!n.vault && !st.unlocked) close(); };

  // Close on a backdrop click only — not when a text selection that started in the sheet ends on the backdrop.
  return <div onPointerDown={e => { downOnBackdrop.current = e.target === e.currentTarget; }} onClick={e => { if (downOnBackdrop.current && e.target === e.currentTarget) close(); }} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(20,16,12,.38)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', display: 'flex', justifyContent: 'center', alignItems: mobile ? 'flex-end' : 'center', padding: mobile ? '40px 0 0' : 32, overflow: 'auto' }}>
    <section role="dialog" aria-modal="true" aria-label={n.title} onClick={e => e.stopPropagation()} style={{ ...tone, width: '100%', maxWidth: 720, background: 'var(--sf)', borderRadius: mobile ? '22px 22px 0 0' : 22, boxShadow: '0 30px 80px rgba(0,0,0,.3)', animation: 'siftin .22s ease-out', display: 'flex', flexDirection: 'column', maxHeight: mobile ? 'calc(100vh - 40px)' : 'calc(100vh - 64px)', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px', borderBottom: '1px solid var(--ln)', position: 'sticky', top: 0, background: 'var(--sf)', zIndex: 1, flexWrap: 'wrap' }}>
        <button className="h-sf2" onClick={close} style={{ border: 0, background: 'transparent', padding: '4px 8px', borderRadius: 6, color: 'var(--mu)', fontSize: 13 }}>Esc · Close</button>
        <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 11, color: 'var(--mu)' }}>{fmtLong(n.ts)}</span>
        <button className="h-ac" onClick={toggleVault} style={{ ...ghostBtn, color: n.vault ? c.ac : ink }}>{n.vault ? 'Remove from vault' : 'Move to vault'}</button>
        <button className="h-ac" onClick={() => void st.updateNote(n.id, { pinned: !n.pinned })} style={{ ...ghostBtn, color: n.pinned ? c.ac : ink }}>{n.pinned ? 'Unpin' : 'Pin'}</button>
        <button className="h-ac" onClick={() => { void st.updateNote(n.id, { archived: !n.archived }); close(); }} style={ghostBtn}>{n.archived ? 'Unarchive' : 'Archive'}</button>
      </div>
      <div style={{ padding: '28px 28px 40px', display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <NoteChips n={n} conflict={conflict} />
            <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--mu)' }}>{n.lang} · {n.source_file || 'captured in Sift'}</span>
          </div>
          <h2 style={{ margin: 0, fontFamily: SERIF, fontSize: mobile ? 30 : 40, fontWeight: 300, lineHeight: 1.1, letterSpacing: '-.03em', textWrap: 'pretty' }}>{n.title || 'Untitled'}</h2>
        </div>
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 18px', borderRadius: 14, background: 'var(--bg)', borderLeft: '2px solid var(--ac)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontFamily: MONO, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--mu)' }}>
            <span>Summary</span><span style={{ textTransform: 'none', letterSpacing: 0 }}>{n.summary ? 'saved at import' : ''}</span>
            <button disabled title={NO_AI} style={{ marginLeft: 'auto', padding: '5px 12px', border: 0, borderRadius: 999, background: 'var(--ink)', color: 'var(--bg)', fontFamily: SANS, fontSize: 12, textTransform: 'none', letterSpacing: 0, opacity: .45 }}>Summarise</button>
          </div>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, whiteSpace: 'pre-line', color: n.summary ? 'var(--ink)' : 'var(--mu)' }}>{n.summary || NO_AI + '.'}</p>
          {n.summary_orig && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.75, color: 'var(--mu)', borderTop: '1px solid var(--ln)', paddingTop: 10 }}>{n.summary_orig}</p>}
          {n.todoList.length > 0 && <ul style={{ margin: 0, padding: '10px 0 0', listStyle: 'none', borderTop: '1px solid var(--ln)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {n.todoList.map(t => <li key={t.id} onClick={() => void st.toggleTodo(t.id)} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', fontSize: 14 }}>
              <Check done={t.done} size={16} font={9} />
              <span style={{ flex: 1, textDecoration: t.done ? 'line-through' : 'none', color: t.done ? mu : ink }}>{t.text}</span>
              {t.wf_item_key && <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--ac)' }}>WF</span>}
            </li>)}
          </ul>}
        </section>
        {related.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--mu)' }}>Related by relevance</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {related.map(({ o, sim }) => { const pct = Math.round(sim * 100) + '%'; return <button key={o.id} className="h-sf2" onClick={() => st.openNote(o.id)} style={{ display: 'grid', gridTemplateColumns: '10px 1fr 90px auto', gap: 12, alignItems: 'center', padding: '9px 10px', margin: '0 -10px', border: 0, borderTop: '1px solid var(--ln)', borderRadius: 8, background: 'transparent', textAlign: 'left' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: topicColor(o.topic, dark) }} />
              <span style={{ fontFamily: SERIF, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.title || 'Untitled'}</span>
              <span style={{ height: 3, borderRadius: 2, background: 'var(--sf2)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: pct, background: 'var(--ac)' }} /></span>
              <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--mu)' }}>{pct}</span>
            </button>; })}
          </div>
        </div>}
        {img && <div role="img" aria-label="Attached image" style={{ width: '100%', height: 300, borderRadius: 14, border: '1px solid var(--ln)', background: `var(--bg) url("${img}") center/contain no-repeat` }} />}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <HighlightableBody noteId={n.id} text={n.body} own={own} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: SERIF, fontSize: 18, lineHeight: 1.65, textWrap: 'pretty' }}>
            <Highlighted segs={coll ? coll.segs : segments(n.body, [], [], [], own)} concept={coll?.concept} dark={coll ? coll.look.dark : dark} />
          </HighlightableBody>
          {coll && <div style={{ fontSize: 12, color: 'var(--mu)', paddingTop: 10, borderTop: '1px solid var(--ln)' }}>{coll.line}</div>}
        </div>
        {conflict && <button onClick={() => st.go('conflicts')} style={{ alignSelf: 'flex-start', padding: '8px 14px', border: '1px solid var(--ac)', borderRadius: 999, background: 'var(--acs)', color: 'var(--ac)', fontSize: 12 }}>A near-duplicate exists → review</button>}
      </div>
    </section>
  </div>;
}
