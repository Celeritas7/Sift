import { useState } from 'react';
import { useStore } from '../state/store';
import { useConflicts, useIsMobile, usePalette, type NoteV } from '../state/derived';
import { MONO, SERIF } from '../lib/config';
import { fmtLong, plural } from '../lib/format';
import { H1, Lede } from '../components/ui';

type Pair = { a: string; b: string; sim: number; A: NoteV; B: NoteV };

const describe = (A: NoteV, B: NoteV) => {
  if (A.body === B.body && A.title === B.title) return 'identical text';
  if (A.body.trimEnd() === B.body.trimEnd()) return 'differ by a trailing newline';
  if (A.body.replace(/\s+/g, ' ').trim() === B.body.replace(/\s+/g, ' ').trim()) return 'differ only in spacing';
  const la = new Set(A.body.split('\n')), lb = new Set(B.body.split('\n')); const d = [...la].filter(l => !lb.has(l)).length + [...lb].filter(l => !la.has(l)).length;
  return d ? 'differ in ' + plural(d, 'line') : 'differ by ' + plural(Math.abs(A.body.length - B.body.length), 'character');
};
const sourceLabel = (n: NoteV) => (n.source === 'keep-json' ? 'JSON export' : n.source === 'keep-html' ? 'HTML export' : 'Written in Sift');
/** Which copy survives a merge: the JSON export over HTML, then the pinned one, then the most recently edited. */
const keeper = (A: NoteV, B: NoteV) => { const score = (n: NoteV) => (n.source === 'keep-json' ? 4 : 0) + (n.pinned ? 2 : 0); const sa = score(A), sb = score(B);
  return sa !== sb ? (sa > sb ? [A, B] : [B, A]) : Date.parse(A.edited_at) >= Date.parse(B.edited_at) ? [A, B] : [B, A]; };
const tidy = (body: string) => (/^[\d,\s]+$/.test(body.trim()) ? body.split(/[,\s]+/).filter(Boolean).map(Number).sort((x, y) => x - y).join(', ') : body);

function PairCard({ p, resolved, onResolve, onUndo }: { p: Pair; resolved?: 'kept' | 'merged'; onResolve: (k: 'kept' | 'merged') => void; onUndo: () => void }) {
  const { c } = usePalette(); const mobile = useIsMobile(); const [mode, setMode] = useState<'review' | 'merge'>('review');
  const [keep, drop] = keeper(p.A, p.B);
  const tog = (on: boolean): React.CSSProperties => ({ padding: '5px 12px', border: 0, borderRadius: 999, background: on ? c.ink : 'transparent', color: on ? c.bg : c.ink, fontSize: 12 });
  return <section style={{ border: '1px solid var(--ln)', borderRadius: 18, background: 'var(--sf)', overflow: 'hidden' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 22px', borderBottom: '1px solid var(--ln)', flexWrap: 'wrap' }}>
      <span style={{ fontFamily: SERIF, fontSize: 40, fontWeight: 300, letterSpacing: '-.03em', lineHeight: 1, color: 'var(--ac)' }}>{Math.round(p.sim * 100)}%</span>
      <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontFamily: SERIF, fontSize: 19 }}>{keep.title || 'Untitled'}</span><span style={{ fontSize: 12, color: 'var(--mu)' }}>2 copies · {describe(p.A, p.B)}</span></div>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 2, padding: 3, borderRadius: 999, background: 'var(--bg)', border: '1px solid var(--ln)' }}>
        <button onClick={() => setMode('review')} style={tog(mode === 'review')}>Review</button>
        <button onClick={() => setMode('merge')} style={tog(mode === 'merge')}>Merge suggestion</button>
      </div>
    </div>
    {mode === 'review' ? <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr' }}>
      {[p.A, p.B].map(n => <div key={n.id} style={{ padding: '20px 22px', borderRight: '1px solid var(--ln)', display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontFamily: MONO, fontSize: 11, color: 'var(--mu)' }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.source_file || 'captured in Sift'}</span><span style={{ flex: 'none' }}>{fmtLong(n.ts)}</span></div>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: SERIF, fontSize: 16, lineHeight: 1.55, maxHeight: 360, overflow: 'auto' }}>{n.body}</pre>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          {[n.pinned ? 'Pinned' : 'Not pinned', sourceLabel(n), n.todoList.length ? plural(n.todoList.length, 'item') : plural(n.body.split(/\s+/).filter(Boolean).length, 'word')].map(f =>
            <span key={f} style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.04em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 4, border: '1px solid var(--ln)', color: 'var(--mu)' }}>{f}</span>)}
        </div>
      </div>)}
    </div> : <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 13, color: 'var(--mu)' }}>Keeps the {keep.pinned ? 'pinned ' : ''}{sourceLabel(keep).replace(' export', '')} copy and moves the {sourceLabel(drop).replace(' export', '')} copy to the archive.</div>
      <div style={{ padding: '16px 18px', borderRadius: 14, background: 'var(--acs)', border: '1px solid var(--ac)' }}>
        <div style={{ fontFamily: SERIF, fontSize: 19 }}>{keep.title || 'Untitled'}</div>
        <pre style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap', fontFamily: MONO, fontSize: 13, lineHeight: 1.7, maxHeight: 360, overflow: 'auto' }}>{tidy(keep.body)}</pre>
      </div>
    </div>}
    <div style={{ display: 'flex', gap: 8, padding: '14px 22px', borderTop: '1px solid var(--ln)', flexWrap: 'wrap', alignItems: 'center' }}>
      {!resolved ? <>
        <button className="h-ac" onClick={() => onResolve('kept')} style={{ padding: '8px 16px', border: '1px solid var(--ln)', borderRadius: 999, background: 'transparent', fontSize: 13 }}>Keep both</button>
        <button onClick={() => onResolve('merged')} style={{ padding: '8px 16px', border: 0, borderRadius: 999, background: 'var(--ink)', color: 'var(--bg)', fontSize: 13 }}>Merge into one</button>
      </> : <>
        <span style={{ color: 'var(--mu)', fontSize: 13 }}>{resolved === 'merged' ? `Merged. The ${sourceLabel(drop).replace(' export', '')} copy moved to the archive.` : 'Kept both. They stay linked as a pair.'}</span>
        <button onClick={onUndo} style={{ border: 0, background: 'transparent', color: 'var(--ac)', padding: '4px 8px', fontSize: 13 }}>Undo</button>
      </>}
    </div>
  </section>;
}

export function Conflicts() {
  const st = useStore(); const pairs = useConflicts(); const [done, setDone] = useState<(Pair & { kind: 'kept' | 'merged'; drop: string })[]>([]);
  const resolve = async (p: Pair, kind: 'kept' | 'merged') => {
    const drop = keeper(p.A, p.B)[1].id; setDone(d => [...d, { ...p, kind, drop }]);
    if (kind === 'kept') await st.dismissPair(p.a, p.b, true); else await st.updateNote(drop, { archived: true });
  };
  const undo = async (p: (typeof done)[number]) => { setDone(d => d.filter(x => x !== p)); if (p.kind === 'kept') await st.dismissPair(p.a, p.b, false); else await st.updateNote(p.drop, { archived: false }); };
  const n = pairs.length;
  return <>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <H1>{n === 0 ? 'No open conflicts' : n === 1 ? 'One pair to resolve' : n + ' pairs to resolve'}</H1>
      <Lede>Takeout sometimes exports one note as both JSON and HTML. Notes that share most of their content are paired here.</Lede>
    </div>
    {done.map(p => <PairCard key={'d' + p.a + p.b} p={p} resolved={p.kind} onResolve={() => {}} onUndo={() => void undo(p)} />)}
    {pairs.map(p => <PairCard key={p.a + p.b} p={p} onResolve={k => void resolve(p, k)} onUndo={() => {}} />)}
  </>;
}
