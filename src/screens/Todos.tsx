import { useStore } from '../state/store';
import { useNotes, usePalette, type NoteV } from '../state/derived';
import { useWfStats } from '../state/counts';
import { suggestItem } from '../lib/wf';
import { MONO, SERIF } from '../lib/config';
import { fmtShort, plural } from '../lib/format';
import { Check, H1, Lede } from '../components/ui';
import type { Todo } from '../types';

/** One to-do line with its "→ Weekly Focus" send flow; shared by the To-dos screen. */
export function TodoRow({ n, t }: { n: NoteV; t: Todo }) {
  const st = useStore(); const { c } = usePalette(); const wf = useWfStats();
  const sending = st.sendFor === t.id; const suggested = suggestItem(Object.values(st.wf), n.topic);
  const sendItem = st.sendItem ?? suggested ?? '';
  return <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--ln)' }}>
    <div className="h-sf" onClick={() => void st.toggleTodo(t.id)} style={{ display: 'grid', gridTemplateColumns: '24px 1fr auto', gap: 14, alignItems: 'start', padding: '14px 12px', margin: '0 -12px', borderRadius: 10, cursor: 'pointer' }}>
      <Check done={t.done} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <span style={{ fontFamily: SERIF, fontSize: 18, textDecoration: t.done ? 'line-through' : 'none', color: t.done ? c.mu : c.ink }}>{t.text}</span>
        <button className="h-col" onClick={e => { e.stopPropagation(); st.openNote(n.id); }} style={{ border: 0, background: 'transparent', padding: 0, textAlign: 'left', fontSize: 12, color: 'var(--mu)' }}>from {n.title || 'Untitled'} · {fmtShort(n.ts)}</button>
      </div>
      {t.wf_item_key ? <span style={{ fontFamily: MONO, fontSize: 10, padding: '3px 8px', borderRadius: 999, background: 'var(--acs)', color: 'var(--ac)', whiteSpace: 'nowrap' }}>WF · {t.wf_item_key}</span>
        : !sending && wf.items.length > 0 && <button className="h-acc" onClick={e => { e.stopPropagation(); st.set({ sendFor: t.id, sendItem: suggested }); }} style={{ padding: '4px 10px', border: '1px solid var(--ln)', borderRadius: 999, background: 'transparent', fontSize: 12, whiteSpace: 'nowrap' }}>→ Weekly Focus</button>}
    </div>
    {sending && <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '0 0 14px 38px', padding: '12px 14px', borderRadius: 12, background: 'var(--acs)', animation: 'siftin .18s ease-out' }}>
      <span style={{ fontSize: 13 }}>Add to</span>
      <select value={sendItem} onChange={e => st.set({ sendItem: e.target.value })} style={{ padding: '6px 10px', border: '1px solid var(--ln)', borderRadius: 8, background: 'var(--sf)', fontFamily: MONO, fontSize: 12 }}>
        {wf.items.map(i => <option key={i.item_key} value={i.item_key}>{i.item_key}{i.item_key === suggested ? '  (suggested)' : ''}</option>)}
      </select>
      <span style={{ fontSize: 13, color: 'var(--mu)' }}>as {n.topic === 'eng' ? 'office' : 'personal'} · suggested</span>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
        <button onClick={() => st.set({ sendFor: null })} style={{ padding: '6px 12px', border: 0, borderRadius: 999, background: 'transparent', fontSize: 12, color: 'var(--mu)' }}>Cancel</button>
        <button onClick={() => sendItem && void st.sendTodo(t.id, sendItem)} style={{ padding: '6px 14px', border: 0, borderRadius: 999, background: 'var(--ink)', color: 'var(--bg)', fontSize: 12 }}>Confirm</button>
      </div>
    </div>}
  </div>;
}

export function Todos() {
  const { open, active } = useNotes(); const unlocked = useStore(s => s.unlocked);
  const rows = open.filter(n => n.todoList.length).flatMap(n => n.todoList.map(t => ({ n, t })));
  const openCount = rows.filter(r => !r.t.done).length;
  const hidden = active.filter(n => n.hidden).reduce((k, n) => k + n.todoList.length, 0);
  return <>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <H1>{plural(openCount, 'thing to do', 'things to do')}</H1>
      <Lede max={60}>Pulled out of your notes. Send any of them to Weekly Focus. Sift suggests the item, you confirm. {hidden && !unlocked ? hidden + ' more are locked in the vault.' : ''}</Lede>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 820 }}>
      {rows.map(({ n, t }) => <TodoRow key={t.id} n={n} t={t} />)}
      {!rows.length && <p style={{ margin: 0, fontFamily: SERIF, fontSize: 24, fontWeight: 300, fontStyle: 'italic', color: 'var(--mu)' }}>No to-dos. Lines starting with “- [ ]” become one.</p>}
    </div>
  </>;
}
