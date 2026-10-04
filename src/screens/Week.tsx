import { useStore } from '../state/store';
import { useIsMobile, useNotes, usePalette, useTick } from '../state/derived';
import { useWfStats } from '../state/counts';
import { boardMeta } from '../lib/wf';
import { cloud } from '../lib/supabase';
import { MONO, SERIF } from '../lib/config';
import { plural } from '../lib/format';
import { Check, Eyebrow, H1, Lede } from '../components/ui';

export function Week() {
  useTick(1000);
  const st = useStore(); const { c } = usePalette(); const mobile = useIsMobile(); const wf = useWfStats(); const { byId } = useNotes();
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
        return <section key={it.item_key} style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--ln)', borderRadius: 16, background: 'var(--sf)', overflow: 'hidden' }}>
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
              return <div key={s.id} className="h-sf2" onClick={() => void st.toggleWfSubtask(it.item_key, s.id)} style={{ display: 'grid', gridTemplateColumns: '22px 1fr', gap: 10, padding: 10, borderRadius: 10, cursor: 'pointer' }}>
                <Check done={s.done} size={18} font={10} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
                  <span style={{ fontSize: 14, textDecoration: s.done ? 'line-through' : 'none', color: s.done ? c.mu : c.ink }}>{s.t}</span>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                    {badges.map((b, i) => <span key={i} style={{ fontFamily: MONO, fontSize: 10, padding: '1px 6px', borderRadius: 4, background: b.bg, color: b.color }}>{b.t}</span>)}
                    {nid && <button className="h-ul" onClick={e => { e.stopPropagation(); if (note) st.openNote(note.id); }} style={{ border: 0, background: 'transparent', padding: 0, fontSize: 11, color: 'var(--ac)' }}>
                      ↗ {note ? (note.hidden ? 'Locked note' : note.title || 'Untitled') : 'note'}</button>}
                  </div>
                </div>
              </div>;
            })}
            {!subs.length && <p style={{ margin: '8px 10px', fontSize: 13, color: 'var(--mu)', fontStyle: 'italic' }}>All tasks here are parked.</p>}
          </div>
        </section>;
      })}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 14 }}>
      {([['Done last week', meta.eowDone], ['Carried over', meta.eowCarry]] as const).map(([k, v]) =>
        <div key={k} style={{ padding: '16px 18px', borderRadius: 14, border: '1px dashed var(--ln)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--mu)' }}>{k}</span>
          <span style={{ fontFamily: SERIF, fontSize: 17 }}>{v || '—'}</span>
        </div>)}
    </div>
  </>;
}
