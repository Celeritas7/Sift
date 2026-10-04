import { useRef, useState } from 'react';
import { useStore } from '../state/store';
import { useConflicts, useIndex, useNotes } from '../state/derived';
import { filesFromDrop, runImport, type ImportStats } from '../lib/importer';
import { MONO, SERIF } from '../lib/config';

export function ImportModal() {
  const st = useStore(); const index = useIndex(); const { open } = useNotes(); const conflicts = useConflicts();
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle'); const [pct, setPct] = useState(0); const [stage, setStage] = useState('');
  const [stats, setStats] = useState<ImportStats | null>(null); const [err, setErr] = useState<string | null>(null); const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const close = () => { if (phase !== 'running') st.set({ importOpen: false }); };
  const start = async (files: File[]) => {
    if (!files.length) return; setErr(null); setPhase('running'); setPct(0);
    try { setStats(await runImport(files, (p, s) => { setPct(p); setStage(s); }, index, open)); setPhase('done'); }
    catch (e) { setErr('Could not read those files: ' + ((e as Error).message || e)); setPhase('idle'); }
  };
  return <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(20,16,12,.45)', zIndex: 60, display: 'grid', placeItems: 'center', padding: 20 }}>
    <div role="dialog" aria-modal="true" aria-label="Import from Google Takeout" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: 'var(--sf)', borderRadius: 20, padding: 26, display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 20px 60px rgba(0,0,0,.25)', animation: 'siftin .2s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 style={{ margin: 0, fontFamily: SERIF, fontSize: 24, fontWeight: 400, letterSpacing: '-.02em' }}>Import from Google Takeout</h2>
        <button onClick={close} aria-label="Close" style={{ border: 0, background: 'transparent', color: 'var(--mu)', fontSize: 18, lineHeight: 1 }}>×</button>
      </div>
      {phase === 'idle' && <>
        <ol style={{ margin: 0, paddingLeft: 18, color: 'var(--mu)', fontSize: 13, lineHeight: 1.7 }}>
          <li>takeout.google.com → Deselect all → tick <b style={{ color: 'var(--ink)' }}>Keep</b></li>
          <li>Create export, download the zip</li>
          <li>Drop the zip or the <span style={{ fontFamily: MONO, fontSize: 12 }}>Takeout/Keep</span> folder below</li>
        </ol>
        <button className="h-drop" onClick={() => input.current?.click()}
          onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={async e => { e.preventDefault(); setOver(false); await start(await filesFromDrop(e.dataTransfer)); }}
          style={{ border: `1.5px dashed ${over ? 'var(--ac)' : 'var(--ln)'}`, borderRadius: 14, padding: '34px 20px', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: over ? 'var(--ac)' : 'var(--mu)' }}>
          <span style={{ fontFamily: SERIF, fontSize: 18, color: 'var(--ink)' }}>Drop files here</span>
          <span style={{ fontSize: 12 }}>.zip · .json · .html · images</span>
        </button>
        <input ref={input} type="file" multiple accept=".zip,.json,.html,.htm,image/*" hidden onChange={e => void start([...(e.target.files || [])])} />
        {err && <span style={{ fontSize: 13, color: 'var(--ac)' }}>{err}</span>}
      </>}
      {phase === 'running' && <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>{stage}</span><span style={{ fontFamily: MONO, color: 'var(--mu)' }}>{Math.round(pct)}%</span></div>
        <div style={{ height: 4, borderRadius: 2, background: 'var(--sf2)', overflow: 'hidden' }}><div style={{ height: '100%', width: pct + '%', background: 'var(--ac)', transition: 'width .25s' }} /></div>
      </div>}
      {phase === 'done' && stats && <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
          {[{ v: stats.files, k: 'files read' }, { v: stats.imported, k: 'unique notes' }, { v: conflicts.length, k: conflicts.length === 1 ? 'near-duplicate pair' : 'near-duplicate pairs' }, { v: stats.languages, k: stats.languages === 1 ? 'language' : 'languages' }].map(s =>
            <div key={s.k} style={{ padding: '12px 14px', border: '1px solid var(--ln)', borderRadius: 12 }}><div style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 300 }}>{s.v}</div><div style={{ fontSize: 12, color: 'var(--mu)' }}>{s.k}</div></div>)}
        </div>
        {stats.skipped > 0 && <span style={{ fontSize: 12, color: 'var(--mu)' }}>{stats.skipped} skipped: already imported, trashed or empty.</span>}
        <button onClick={() => { st.set({ importOpen: false }); st.go('stream'); }} style={{ padding: '10px 14px', border: 0, borderRadius: 999, background: 'var(--ink)', color: 'var(--bg)' }}>Open the stream</button>
      </>}
    </div>
  </div>;
}
