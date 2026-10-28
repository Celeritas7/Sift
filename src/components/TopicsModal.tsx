import { useState } from 'react';
import { useStore } from '../state/store';
import { useIsMobile, useNotes, usePalette } from '../state/derived';
import { BUILTIN_IDS, defaultSummary, MAX_SUMMARY, MAX_TOPICS, MONO, SERIF, TOPIC_HUES, TOPICS, type TopicSetting } from '../lib/config';
import { plural } from '../lib/format';
import { ghostBtn, inkBtn } from './ui';

const swatch = (hue: number | null, dark: boolean) => (hue == null ? (dark ? '#8A8078' : '#9A9087') : `oklch(${dark ? 0.74 : 0.6} 0.13 ${hue})`);
const newId = () => 'u_' + Math.random().toString(36).slice(2, 8);

/** Add, rename, recolour, describe and delete topics. Built-ins can't be deleted; a deleted topic's notes move to Scraps. */
export function TopicsModal() {
  const st = useStore(); const { c, dark } = usePalette(); const mobile = useIsMobile(); const { all } = useNotes();
  const [list, setList] = useState<TopicSetting[]>(() => TOPICS.map(t => ({ id: t.id, name: t.name, hue: t.hue, summary: t.summary })));
  const [picking, setPicking] = useState<string | null>(null); const [confirm, setConfirm] = useState<string | null>(null);
  const [adding, setAdding] = useState(''); const [saving, setSaving] = useState(false);
  const count = (id: string) => all.filter(n => !n.deleted_at && n.topic === id).length;
  const names = list.map(t => t.name.trim().toLowerCase());
  const problem = list.some(t => !t.name.trim()) ? 'Every topic needs a name.' : names.some((n, i) => names.indexOf(n) !== i) ? 'Two topics have the same name.' : '';
  const addName = adding.trim(); const addProblem = !addName ? '' : names.includes(addName.toLowerCase()) ? 'You already have a topic with that name.' : list.length >= MAX_TOPICS ? `Up to ${MAX_TOPICS} topics.` : '';
  const set = (id: string, p: Partial<TopicSetting>) => setList(l => l.map(t => (t.id === id ? { ...t, ...p } : t)));
  // A built-in's own description follows its name: renaming it clears an untouched default, naming it back restores it.
  const rename = (t: TopicSetting, name: string) => { const was = defaultSummary(t.id, t.name), now = defaultSummary(t.id, name);
    set(t.id, { name, ...(t.summary === was || !t.summary ? { summary: now } : {}) }); };
  const add = () => { if (!addName || addProblem) return; const used = new Set(list.map(t => t.hue)); const hue = TOPIC_HUES.find(h => h !== null && !used.has(h)) ?? null;
    setList(l => [...l, { id: newId(), name: addName.slice(0, 40), hue }]); setAdding(''); };
  const close = () => st.set({ topicsOpen: false });
  // Save a description only when it differs from the default, so built-ins keep following the default text.
  const toSave = () => list.map(({ summary, ...t }) => { const d = (summary ?? '').trim(); return d === defaultSummary(t.id, t.name) ? t : { ...t, summary: d }; });
  const save = async () => { if (problem) return; setSaving(true); const moved = await st.saveTopics(toSave()); setSaving(false);
    if (moved) st.set({ error: `${plural(moved, 'note')} moved to Scraps.` }); close(); };
  const tap = mobile ? { minHeight: 44 } : {};

  return <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(20,16,12,.45)', display: 'grid', placeItems: mobile ? 'end center' : 'center', padding: mobile ? 0 : 20, overflow: 'auto' }}>
    <div role="dialog" aria-modal="true" aria-label="Topics" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 520, maxHeight: mobile ? '92dvh' : '86dvh', overflow: 'auto', background: 'var(--sf)', borderRadius: mobile ? '22px 22px 0 0' : 20, padding: mobile ? 18 : 24, display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 20px 60px rgba(0,0,0,.25)', animation: 'siftin .2s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 style={{ margin: 0, fontFamily: SERIF, fontSize: 26, fontWeight: 400 }}>Topics</h2>
        <button onClick={close} aria-label="Close" style={{ border: 0, background: 'transparent', fontSize: 20, color: 'var(--mu)', minWidth: 44, minHeight: 44 }}>×</button>
      </div>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--mu)' }}>Rename, recolour, describe or add topics. Type <span style={{ fontFamily: MONO }}>#name</span> in a note to file it under one.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {list.map(t => { const n = count(t.id), builtin = BUILTIN_IDS.has(t.id);
          return <div key={t.id} data-topic-row={t.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px', border: '1px solid var(--ln)', borderRadius: 12, background: 'var(--bg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => setPicking(picking === t.id ? null : t.id)} aria-label={`Colour of ${t.name || 'topic'}`} aria-expanded={picking === t.id}
                style={{ width: 28, height: 28, flex: 'none', borderRadius: '50%', border: '2px solid var(--sf)', boxShadow: `0 0 0 1px ${c.ln}`, background: swatch(t.hue, dark), ...(mobile ? { width: 32, height: 32 } : {}) }} />
              <input value={t.name} onChange={e => rename(t, e.target.value.slice(0, 40))} aria-label="Topic name" maxLength={40}
                style={{ flex: 1, minWidth: 0, padding: '7px 10px', border: '1px solid var(--ln)', borderRadius: 8, background: 'var(--sf)', fontSize: 15, ...tap }} />
              <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--mu)', flex: 'none' }}>{n}</span>
              {builtin ? <span title={t.id === 'career' ? 'Always kept in the vault' : 'Built-in topic'} style={{ fontFamily: MONO, fontSize: 10, color: 'var(--mu)', flex: 'none', width: 44, textAlign: 'center' }}>{t.id === 'career' ? 'VAULT' : ''}</span>
                : <button onClick={() => (n && confirm !== t.id ? setConfirm(t.id) : setList(l => l.filter(x => x.id !== t.id)))} aria-label={`Delete ${t.name}`}
                  style={{ ...ghostBtn, flex: 'none', minWidth: 44, padding: '4px 12px', ...tap, color: confirm === t.id ? c.ac : undefined, borderColor: confirm === t.id ? c.ac : undefined }}>{confirm === t.id ? `Move ${n} to Scraps` : 'Delete'}</button>}
            </div>
            <textarea value={t.summary ?? ''} onChange={e => set(t.id, { summary: e.target.value.replace(/\s*\n\s*/g, ' ').slice(0, MAX_SUMMARY) })} rows={2} maxLength={MAX_SUMMARY}
              aria-label={`Description of ${t.name || 'topic'}`} placeholder="Description, shown on Lens (optional)"
              style={{ marginLeft: mobile ? 0 : 36, padding: '6px 10px', border: '1px solid var(--ln)', borderRadius: 8, background: 'var(--sf)', fontSize: mobile ? 16 : 13, lineHeight: 1.45, color: 'var(--ink)', resize: 'vertical', fontFamily: 'inherit' }} />
            {picking === t.id && <div role="radiogroup" aria-label="Colour" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingLeft: 36 }}>
              {TOPIC_HUES.map(h => <button key={String(h)} role="radio" aria-checked={t.hue === h} aria-label={h == null ? 'Grey' : 'Hue ' + h} onClick={() => { set(t.id, { hue: h }); setPicking(null); }}
                style={{ width: mobile ? 34 : 24, height: mobile ? 34 : 24, borderRadius: '50%', border: `2px solid ${t.hue === h ? c.ink : 'transparent'}`, background: swatch(h, dark) }} />)}
            </div>}
          </div>; })}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={adding} onChange={e => setAdding(e.target.value.slice(0, 40))} onKeyDown={e => { if (e.key === 'Enter') add(); }} placeholder="New topic, e.g. Travel" aria-label="New topic name"
          style={{ flex: 1, minWidth: 0, padding: '8px 12px', border: '1px solid var(--ln)', borderRadius: 999, background: 'var(--bg)', fontSize: 14, ...tap }} />
        <button onClick={add} disabled={!addName || !!addProblem} style={{ ...inkBtn, opacity: addName && !addProblem ? 1 : .45, ...tap }}>Add</button>
      </div>
      {(addProblem || problem) && <p role="alert" style={{ margin: 0, fontSize: 13, color: c.ac }}>{addProblem || problem}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={close} style={{ ...ghostBtn, padding: '6px 14px', fontSize: 13, ...tap }}>Cancel</button>
        <button onClick={() => void save()} disabled={!!problem || saving} style={{ ...inkBtn, opacity: problem ? .45 : 1, ...tap }}>{saving ? 'Saving…' : 'Save topics'}</button>
      </div>
    </div>
  </div>;
}
