import { useStore } from '../state/store';
import { useIsMobile, useNotes, usePalette } from '../state/derived';
import { useWeeks } from '../state/counts';
import { MONO, SERIF, TOPICS } from '../lib/config';
import { plural } from '../lib/format';
import { Eyebrow, H1, Lede } from '../components/ui';
import { DigestButton } from '../components/DigestButton';

export function Lens() {
  const st = useStore(); const { c } = usePalette(); const mobile = useIsMobile(); const { active } = useNotes(); const { weeks, current } = useWeeks();
  const langs = new Set(active.filter(n => !n.hidden && n.lang !== '—').map(n => n.lang));
  const setFilter = (f: string) => st.set({ filter: f, view: 'stream', selId: null, query: '' });
  return <>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <H1>What your notes are about</H1>
      <Lede>Six threads across your notes and {plural(langs.size, 'language')}. Tap one to filter the stream.</Lede>
    </div>
    <section style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(4,minmax(0,1fr))', gap: 12 }}>
      {TOPICS.map((t, i) => {
        const ns = active.filter(n => n.topic === t.id), locked = ns.length > 0 && ns.every(n => n.hidden);
        const tl = [...new Set(ns.filter(n => !n.hidden).map(n => n.lang).filter(l => l !== '—'))], labels = [...new Set(ns.filter(n => !n.hidden).flatMap(n => n.labels))].slice(0, 3);
        const alt = [tl.join(' · '), labels.join(' · ')].filter(Boolean).join(' · ') || 'No notes yet';
        return <button key={t.id} className="h-lift" onClick={() => (locked ? st.askPin() : setFilter(t.id))}
          style={{ gridColumn: mobile ? 'span 1' : t.span, display: 'flex', flexDirection: 'column', gap: 12, padding: '20px 22px', border: '1px solid var(--ln)', borderRadius: 18, background: i % 3 === 0 ? c.sf : i % 3 === 1 ? c.acs : c.sf2, textAlign: 'left', minHeight: 200, transition: 'transform .2s,border-color .2s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ fontFamily: SERIF, fontSize: 56, fontWeight: 300, lineHeight: .9, letterSpacing: '-.04em' }}>{locked ? '—' : ns.filter(n => !n.hidden).length}</span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--mu)', textAlign: 'right', maxWidth: '55%' }}>{locked ? 'VAULT · LOCKED' : alt}</span>
          </div>
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <h3 style={{ margin: 0, fontFamily: SERIF, fontSize: 22, fontWeight: 400, letterSpacing: '-.01em' }}>{t.name}</h3>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--mu)', textWrap: 'pretty' }}>{locked ? 'This whole thread lives in your vault. Unlock to see it.' : t.summary}</p>
          </div>
        </button>;
      })}
    </section>
    <section style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'minmax(0,1.3fr) minmax(0,1fr)', gap: mobile ? 22 : 56, paddingTop: mobile ? 28 : 44, borderTop: '1px solid var(--ln)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Eyebrow>Weekly digest</Eyebrow>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {[...weeks].reverse().map(w => { const on = current?.id === w.id; return <button key={w.id} className="h-sf" onClick={() => st.set({ week: w.id })}
            style={{ display: 'grid', gridTemplateColumns: '70px 1fr auto', gap: 12, alignItems: 'center', padding: '10px 12px', margin: '0 -12px', border: 0, borderTop: '1px solid var(--ln)', borderRadius: 10, background: on ? c.sf : 'transparent', textAlign: 'left' }}>
            <span style={{ fontFamily: MONO, fontSize: 12, color: on ? c.ac : c.ink }}>{w.label}</span>
            <span style={{ fontSize: 13, color: 'var(--mu)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.notes.map(n => (n.hidden ? 'Locked note' : n.title || 'Untitled')).join(' · ')}</span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: w.state === '—' ? c.mu : c.ac }}>{w.state}</span>
          </button>; })}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--mu)', cursor: 'pointer' }}>
          <span role="switch" aria-checked={st.settings.monday_digest} onClick={() => void st.setSettings({ monday_digest: !st.settings.monday_digest })}
            style={{ width: 34, height: 20, borderRadius: 999, background: st.settings.monday_digest ? c.ac : c.mu, position: 'relative', transition: 'background .2s', display: 'inline-block', flex: 'none' }}>
            <span style={{ position: 'absolute', top: 2, left: st.settings.monday_digest ? 16 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 2px rgba(0,0,0,.2)' }} />
          </span>Write one automatically every Monday
        </label>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '22px 24px', borderRadius: 18, background: 'var(--sf)', border: '1px solid var(--ln)' }}>
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--mu)' }}>{current ? 'Week of ' + current.label : 'This week'} · {plural(current?.notes.length ?? 0, 'note')}</div>
        <p style={{ margin: 0, fontFamily: SERIF, fontSize: 21, fontWeight: 300, lineHeight: 1.4, whiteSpace: 'pre-line', textWrap: 'pretty' }}>{current?.digest || 'No digest for this week yet.'}</p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 'auto' }}>
          <DigestButton week={current} mobile={mobile} />
        </div>
      </div>
    </section>
  </>;
}
