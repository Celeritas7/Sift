import { useStore } from '../state/store';
import { useNotes } from '../state/derived';
import { MONO, SERIF } from '../lib/config';
import { fmtShort } from '../lib/format';
import { H1 } from '../components/ui';

export function Archive() {
  const openNote = useStore(s => s.openNote); const { all } = useNotes();
  const archived = all.filter(n => n.archived && !n.hidden);
  return <>
    <H1>Archive</H1>
    {archived.length ? <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 760 }}>
      {archived.map(n => <button key={n.id} className="h-arch" onClick={() => openNote(n.id)} style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: 14, padding: '14px 12px', margin: '0 -12px', border: 0, borderTop: '1px solid var(--ln)', borderRadius: 10, background: 'transparent', textAlign: 'left', opacity: .75 }}>
        <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--mu)' }}>{fmtShort(n.ts)}</span>
        <span style={{ fontFamily: SERIF, fontSize: 18 }}>{n.title || 'Untitled'}</span>
      </button>)}
    </div> : <p style={{ margin: 0, fontFamily: SERIF, fontSize: 24, fontWeight: 300, fontStyle: 'italic', color: 'var(--mu)' }}>Nothing archived yet.</p>}
  </>;
}
