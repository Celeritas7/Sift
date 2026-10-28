import { useStore } from '../state/store';
import { useConflicts, useIndex, useIsMobile, useNotes, useOwnHighlights, usePalette, type NoteV } from '../state/derived';
import { SIM_RELATED } from '../similarity';
import { MONO, NO_AI, SANS, SERIF, TAG_TO_TOPIC, TOPICS, topicColor, topicName } from '../lib/config';
import { fmtLong } from '../lib/format';
import { saveNoteEdit } from '../lib/edit';
import { caretHandlers } from '../lib/keyboard';
import { setBeforeLock } from '../lib/vault';
import { useImageUrl } from '../hooks/useImageUrl';
import { NoteChips } from '../screens/Stream';
import { Check, ghostBtn, inkBtn } from './ui';
import { Highlighted, useCollageSheet } from './CollageText';
import { HighlightableBody } from './HighlightToolbar';
import { segments } from '../lib/collage';
import type { Anchored } from '../lib/highlights';
import type { Topic } from '../types';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

const NONE: Anchored[] = [];
const cleanLabel = (s: string) => s.trim().replace(/^#+/, '').trim().toLowerCase();

/** The note's labels, always editable: × removes one, "+ label" adds one (a topic tag moves the note instead). */
function Labels({ n, beforeLeave }: { n: NoteV; beforeLeave: (then: () => void) => void }) {
  const st = useStore(); const mobile = useIsMobile(); const { all } = useNotes(); const { c } = usePalette();
  const [adding, setAdding] = useState(false); const [val, setVal] = useState(''); const [idx, setIdx] = useState(-1);
  const labelsAll = useMemo(() => [...new Set(all.flatMap(x => x.labels))], [all]);
  const have = new Set(n.labels.map(l => l.toLowerCase())); const q = cleanLabel(val);
  const sugg: { k: string; d: string }[] = adding ? [...TOPICS.filter(t => t.id !== n.topic).map(t => ({ k: t.tag, d: 'move to ' + t.name })), ...labelsAll.filter(l => !have.has(l.toLowerCase())).map(l => ({ k: l, d: 'label' }))]
    .filter(x => x.k.toLowerCase().startsWith(q)).slice(0, 7) : [];
  const tap: CSSProperties = mobile ? { minHeight: 44 } : {};

  const close = () => { setAdding(false); setVal(''); setIdx(-1); };
  const add = (raw: string) => {
    const v = cleanLabel(raw); setVal(''); setIdx(-1); if (!v) return;
    const topic = TAG_TO_TOPIC[v] as Topic | undefined;
    if (topic) {
      close(); if (topic === n.topic) return;
      const move = () => { void st.updateNote(n.id, { topic }); st.showToast({ id: n.id, msg: 'Moved to ' + topicName(topic) }); };
      // Career lives in the vault: with the vault locked the sheet closes, so an unsaved draft is saved or discarded first.
      if (topic === 'career' && !useStore.getState().unlocked) beforeLeave(() => { move(); st.set({ selId: null }); }); else move();
    } else if (!have.has(v)) void st.updateNote(n.id, { labels: [...n.labels, v] });
  };
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && sugg.length) { e.preventDefault(); setIdx((idx + 1) % sugg.length); }
    else if (e.key === 'ArrowUp' && sugg.length) { e.preventDefault(); setIdx(idx <= 0 ? sugg.length - 1 : idx - 1); }
    else if (e.key === 'Tab' && sugg.length && q) { e.preventDefault(); setVal(sugg[Math.max(idx, 0)].k); setIdx(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); add(idx >= 0 && sugg[idx] ? sugg[idx].k : val); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
  };

  const chip: CSSProperties = { display: 'inline-flex', alignItems: 'center', fontFamily: MONO, fontSize: 10, letterSpacing: '.04em', textTransform: 'uppercase', borderRadius: 4, ...tap };
  return <>
    {n.labels.map(l => <span key={l} style={{ ...chip, padding: mobile ? '0 0 0 10px' : '2px 2px 2px 7px', background: 'var(--acs)', color: 'var(--ac)' }}>{l}
      <button onClick={() => void st.updateNote(n.id, { labels: n.labels.filter(x => x !== l) })} aria-label={'Remove label ' + l} title="Remove label"
        style={{ width: mobile ? 40 : 16, height: mobile ? 44 : 16, padding: 0, marginLeft: 2, border: 0, borderRadius: 3, background: 'transparent', color: 'inherit', fontSize: mobile ? 16 : 12, lineHeight: 1 }}>×</button>
    </span>)}
    {adding ? <span style={{ position: 'relative', display: 'inline-flex' }}>
      <input autoFocus data-label-input="1" value={val} aria-label="Add a label" placeholder="label or topic" onKeyDown={onKey} onBlur={close}
        onChange={e => { setVal(e.target.value); setIdx(-1); }}
        style={{ ...chip, width: mobile ? 170 : 150, padding: mobile ? '0 10px' : '2px 7px', border: '1px solid var(--ac)', background: 'var(--sf)', color: 'var(--ink)', outline: 'none', textTransform: 'none', fontSize: mobile ? 16 : 11 }} />
      {sugg.length > 0 && <div role="listbox" style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 3, width: 'max-content', minWidth: '100%', maxWidth: 300, padding: 6, border: '1px solid var(--ln)', borderRadius: 14, background: 'var(--sf)', boxShadow: '0 18px 50px rgba(0,0,0,.16)', animation: 'siftin .14s ease-out' }}>
        {sugg.map((x, i) => <button key={x.k} role="option" aria-selected={i === idx} onPointerDown={e => { e.preventDefault(); add(x.k); }}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '6px 10px', border: 0, borderRadius: 9, background: i === idx ? c.acs : 'transparent', textAlign: 'left', ...tap }}>
          <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--ac)' }}>#{x.k}</span><span style={{ fontSize: 12, color: 'var(--mu)' }}>{x.d}</span></button>)}
      </div>}
    </span>
    : <button className="h-ac" onClick={() => setAdding(true)} style={{ ...chip, padding: mobile ? '0 12px' : '2px 7px', border: '1px dashed var(--ln)', background: 'transparent', color: 'var(--mu)', textTransform: 'none', fontSize: 11 }}>+ label</button>}
  </>;
}

export function NoteSheet() {
  const st = useStore(); const { c, dark } = usePalette(); const mobile = useIsMobile(); const { byId, open } = useNotes(); const index = useIndex(); const conflicts = useConflicts();
  const n = st.selId ? byId[st.selId] : null; const img = useImageUrl(n?.image_path);
  const ownBy = useOwnHighlights(); const own = (n && ownBy[n.id]) || NONE;
  const coll = useCollageSheet(st.view === 'collage' && n && !n.hidden ? n : null, own);
  const downOnBackdrop = useRef(false); const sheetRef = useRef<HTMLElement>(null);
  // Edit mode: a draft of title + body, and a pending "Discard changes?" with what to do after discarding.
  const [edit, setEdit] = useState<{ id: string; title: string; body: string } | null>(null);
  const [confirm, setConfirm] = useState<{ then: () => void; msg: string; canSave?: boolean } | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null); const keys = useRef<(e: KeyboardEvent) => void>(() => {});
  const draft = n && !n.hidden && edit?.id === n.id ? edit : null; const editing = !!draft;
  useEffect(() => { setEdit(null); setConfirm(null); }, [st.selId]);
  useLayoutEffect(() => { const t = bodyRef.current; if (t) { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; } }, [editing, draft?.body, mobile]);
  useEffect(() => { const t = bodyRef.current; if (editing && t) { t.focus({ preventScroll: true }); t.setSelectionRange(t.value.length, t.value.length); } }, [editing]);
  // Capture phase, so Esc cancels editing before the app-wide Esc closes the sheet.
  useEffect(() => { if (!editing) return; const f = (e: KeyboardEvent) => keys.current(e); window.addEventListener('keydown', f, true); return () => window.removeEventListener('keydown', f, true); }, [editing]);
  // Locking closes a vault note; its unsaved edits are saved first rather than dropped.
  const flushRef = useRef<(() => void) | null>(null);
  useEffect(() => { setBeforeLock(() => flushRef.current?.()); return () => setBeforeLock(null); }, []);
  flushRef.current = null;
  if (!n || n.hidden) return null;
  // From Collage the sheet takes the card's colours: rebind the theme variables inside the dialog.
  const L = coll?.look; const ink = L ? L.ink : c.ink, mu = L ? L.mu : c.mu;
  const tone: CSSProperties = L ? { '--sf': L.bg, '--ink': L.ink, '--mu': L.mu, '--ln': L.line, '--bg': `color-mix(in srgb, ${L.ink} 6%, ${L.bg})`, '--sf2': `color-mix(in srgb, ${L.ink} 10%, ${L.bg})`, color: L.ink } as CSSProperties : {};
  const related = open.filter(o => o.id !== n.id).map(o => ({ o, sim: index.sim(n.id, o.id) })).filter(x => x.sim > SIM_RELATED).sort((a, b) => b.sim - a.sim).slice(0, 3);
  const conflict = conflicts.some(p => p.a === n.id || p.b === n.id);
  const toggleVault = () => { void st.updateNote(n.id, { vault: !n.vault }); if (!n.vault && !st.unlocked) close(); };

  const dirty = !!draft && (draft.title !== n.title || draft.body !== n.body);
  /** Leave edit mode, then run `then` — after asking first when the draft has changes. */
  const leave = (then: () => void) => { if (dirty) setConfirm({ then, msg: 'Discard changes?' }); else { setEdit(null); then(); } };
  /** Before something that closes the sheet anyway: offer to save the draft first. */
  const beforeLeave = (then: () => void) => { if (dirty) setConfirm({ then, msg: 'Save your changes before moving to the vault?', canSave: true }); else { setEdit(null); then(); } };
  const discard = () => { const then = confirm?.then; setConfirm(null); setEdit(null); then?.(); };
  const close = () => leave(() => st.set({ selId: null }));
  const cancel = () => leave(() => {});
  const save = async () => {
    if (!draft) return; const { title, body } = draft; setConfirm(null); setEdit(null); if (!dirty) return;
    const r = await saveNoteEdit(n.id, title, body);
    if (r) st.showToast({ id: n.id, msg: 'Saved', undo: () => void r.undo() });
  };
  flushRef.current = dirty && n.vault ? () => void save() : null;
  const saveThen = () => { const then = confirm?.then; void save().then(() => then?.()); };
  keys.current = e => {
    if ((e.target as HTMLElement | null)?.dataset?.labelInput) return; // the label input handles its own Esc / Enter
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (confirm) setConfirm(null); else cancel(); }
    else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); e.stopPropagation(); void save(); }
  };

  const tap: CSSProperties = mobile ? { minHeight: 44, padding: '0 16px' } : {};
  const slim = editing && mobile; // on a phone the editor fills the sheet
  const titleStyle: CSSProperties = { margin: 0, fontFamily: SERIF, fontSize: mobile ? 30 : 40, fontWeight: 300, lineHeight: 1.1, letterSpacing: '-.03em' };
  const bodyStyle: CSSProperties = { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: SERIF, fontSize: 18, lineHeight: 1.65 };
  const field: CSSProperties = { width: '100%', margin: 0, padding: 0, border: 0, background: 'transparent', color: 'inherit', outline: 'none' };

  // Close on a backdrop click only — not when a text selection that started in the sheet ends on the backdrop.
  return <div onPointerDown={e => { downOnBackdrop.current = e.target === e.currentTarget; }} onClick={e => { if (downOnBackdrop.current && e.target === e.currentTarget) close(); }} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(20,16,12,.38)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', display: 'flex', justifyContent: 'center', alignItems: mobile ? 'flex-end' : 'center', padding: mobile ? '40px 0 0' : 32, overflow: 'auto' }}>
    <section ref={sheetRef} role="dialog" aria-modal="true" aria-label={n.title} onClick={e => e.stopPropagation()} style={{ ...tone, width: '100%', maxWidth: 720, background: 'var(--sf)', borderRadius: mobile ? '22px 22px 0 0' : 22, boxShadow: '0 30px 80px rgba(0,0,0,.3)', animation: 'siftin .22s ease-out', display: 'flex', flexDirection: 'column', maxHeight: mobile ? 'calc(100dvh - 40px)' : 'calc(100dvh - 64px)', height: slim ? 'calc(100dvh - 40px)' : undefined, overflow: 'auto',
      paddingBottom: 'var(--kb, 0px)', scrollPaddingBottom: 'calc(var(--kb, 0px) + 48px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px', borderBottom: '1px solid var(--ln)', position: 'sticky', top: 0, background: 'var(--sf)', zIndex: 2, flexWrap: 'wrap' }}>
        {confirm ? <>
          <span role="alert" style={{ fontSize: 14, color: ink }}>{confirm.msg}</span>
          <button className="h-sf2" onClick={() => setConfirm(null)} style={{ ...ghostBtn, ...tap, marginLeft: 'auto', color: ink }}>Keep editing</button>
          {confirm.canSave ? <>
            <button className="h-sf2" onClick={discard} style={{ ...ghostBtn, ...tap, color: ink }}>Discard</button>
            <button onClick={saveThen} style={{ ...inkBtn, ...tap }}>Save &amp; move</button>
          </> : <button onClick={discard} style={{ ...inkBtn, ...tap }}>Discard</button>}
        </> : editing ? <>
          <button className="h-sf2" onClick={cancel} style={{ ...ghostBtn, ...tap, color: ink }}>Cancel</button>
          {!mobile && <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 11, color: 'var(--mu)' }}>Ctrl/⌘ + Enter saves · Esc cancels</span>}
          <button onClick={() => void save()} style={{ ...inkBtn, ...tap, marginLeft: mobile ? 'auto' : undefined }}>Save</button>
        </> : <>
          <button className="h-sf2" onClick={close} style={{ border: 0, background: 'transparent', padding: '4px 8px', borderRadius: 6, color: 'var(--mu)', fontSize: 13 }}>Esc · Close</button>
          <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 11, color: 'var(--mu)' }}>{fmtLong(n.ts)}</span>
          <button className="h-ac" onClick={toggleVault} style={{ ...ghostBtn, color: n.vault ? c.ac : ink }}>{n.vault ? 'Remove from vault' : 'Move to vault'}</button>
          {!n.hidden && <button className="h-ac" onClick={() => setEdit({ id: n.id, title: n.title, body: n.body })} style={{ ...ghostBtn, color: ink }}>Edit</button>}
          <button className="h-ac" onClick={() => void st.updateNote(n.id, { pinned: !n.pinned })} style={{ ...ghostBtn, color: n.pinned ? c.ac : ink }}>{n.pinned ? 'Unpin' : 'Pin'}</button>
          <button className="h-ac" onClick={() => { void st.updateNote(n.id, { archived: !n.archived }); close(); }} style={ghostBtn}>{n.archived ? 'Unarchive' : 'Archive'}</button>
        </>}
      </div>
      <div style={{ padding: slim ? '20px 20px 32px' : '28px 28px 40px', display: 'flex', flexDirection: 'column', gap: 22, flex: slim ? 1 : undefined }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <NoteChips n={n} conflict={conflict} labels={false} />
            <Labels n={n} beforeLeave={beforeLeave} />
            <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--mu)' }}>{n.lang} · {n.source_file || 'captured in Sift'}</span>
          </div>
          {draft ? <input aria-label="Title" value={draft.title} placeholder="Untitled" onChange={e => setEdit({ ...draft, title: e.target.value })} style={{ ...titleStyle, ...field }} />
            : <h2 style={{ ...titleStyle, textWrap: 'pretty' }}>{n.title || 'Untitled'}</h2>}
        </div>
        {!slim && <section style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 18px', borderRadius: 14, background: 'var(--bg)', borderLeft: '2px solid var(--ac)' }}>
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
        </section>}
        {!editing && related.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
        {img && !slim && <div role="img" aria-label="Attached image" style={{ width: '100%', height: 300, borderRadius: 14, border: '1px solid var(--ln)', background: `var(--bg) url("${img}") center/contain no-repeat` }} />}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: slim ? 1 : undefined }}>
          {draft ? <textarea ref={bodyRef} aria-label="Note text" value={draft.body} placeholder="Write…" onChange={e => setEdit({ ...draft, body: e.target.value })} {...caretHandlers(() => sheetRef.current)}
            style={{ ...bodyStyle, ...field, resize: 'none', overflow: 'hidden', minHeight: slim ? '50vh' : 160 }} />
            : <HighlightableBody noteId={n.id} text={n.body} own={own} style={{ ...bodyStyle, textWrap: 'pretty' }}>
              <Highlighted segs={coll ? coll.segs : segments(n.body, [], [], [], own)} concept={coll?.concept} dark={coll ? coll.look.dark : dark} />
            </HighlightableBody>}
          {coll && !editing && <div style={{ fontSize: 12, color: 'var(--mu)', paddingTop: 10, borderTop: '1px solid var(--ln)' }}>{coll.line}</div>}
        </div>
        {conflict && !editing && <button onClick={() => st.go('conflicts')} style={{ alignSelf: 'flex-start', padding: '8px 14px', border: '1px solid var(--ac)', borderRadius: 999, background: 'var(--acs)', color: 'var(--ac)', fontSize: 12 }}>A near-duplicate exists → review</button>}
      </div>
    </section>
  </div>;
}
