import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../state/store';
import { suggestFor, useIndex, useIsMobile, useNotes, usePalette } from '../state/derived';
import { registerComposer } from '../state/focus';
import { parseDraft, SLASH, TEMPLATES, templateCaret, VOICE_DEMO, type Flag } from '../lib/parse';
import { BASE_CTX, LINK_HUES, MONO, SERIF, TOPICS, topicColor, topicName } from '../lib/config';
import { ctxFromWf, suggestItem } from '../lib/wf';
import { captureNote } from '../lib/capture';
import type { Topic } from '../types';

type AcItem = { k: string; d: string; flag?: Flag; topic?: Topic };
type SR = { start(): void; stop(): void; interimResults: boolean; continuous: boolean; lang: string; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null };

export function Composer() {
  const st = useStore(); const { c, dark } = usePalette(); const mobile = useIsMobile(); const { open, all } = useNotes(); const index = useIndex();
  const [text, setText] = useState(''); const [caret, setCaret] = useState(0); const [focus, setFocus] = useState(false);
  const [acIdx, setAcIdx] = useState(0); const [acDismiss, setAcDismiss] = useState(false);
  const [flags, setFlags] = useState<Partial<Record<Flag, boolean>>>({}); const [topicOv, setTopicOv] = useState<Topic | null>(null);
  const [listOv, setListOv] = useState<boolean | null>(null); const [img, setImg] = useState<string | null>(null); const [listening, setListening] = useState(false);
  const el = useRef<HTMLTextAreaElement | null>(null); const blurT = useRef<ReturnType<typeof setTimeout>>(undefined);
  const rec = useRef<SR | null>(null); const voiceT = useRef<ReturnType<typeof setInterval>>(undefined); const toastT = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => { st.set({ composerFocused: focus }); }, [focus]);
  useEffect(() => () => { clearInterval(voiceT.current); try { rec.current?.stop(); } catch { /* already stopped */ } }, []);
  useEffect(() => { clearTimeout(toastT.current); if (st.toast) toastT.current = setTimeout(() => st.showToast(null), 6500); }, [st.toast]);

  const pd = parseDraft(text, listOv);
  const deferred = useDeferredValue(text);
  const sug = useMemo(() => (focus && deferred.trim() ? suggestFor(index, open, deferred) : { topic: null, related: [] }), [focus, deferred, index, open]);
  const topic: Topic = topicOv || pd.topicFromTag || sug.topic || 'scrap';
  const topicTag = topicOv || pd.topicFromTag ? '' : sug.topic ? 'AUTO' : '';

  const before = text.slice(0, Math.min(caret, text.length));
  const mS = before.match(/(^|\n)(\/\w*)$/), mH = before.match(/(^|\s)(#[\w-]*)$/), mA = before.match(/(^|\s)(@[\w-]*)$/);
  const ac = focus && !acDismiss ? (mS ? { kind: '/', tok: mS[2] } : mH ? { kind: '#', tok: mH[2] } : mA ? { kind: '@', tok: mA[2] } : null) : null;
  const labelsAll = useMemo(() => [...new Set(all.flatMap(n => n.labels))], [all]);
  const ctxAll = useMemo(() => [...new Set([...BASE_CTX, ...ctxFromWf(Object.values(st.wf))])], [st.wf]);
  let acList: AcItem[] = [];
  if (ac) { const t = ac.tok.toLowerCase();
    if (ac.kind === '/') acList = SLASH.filter(x => x.k.startsWith(t)).map(x => ({ ...x, d: x.flag && flags[x.flag] ? x.d + ' · on' : x.d }));
    else if (ac.kind === '#') acList = [...TOPICS.map(tp => ({ k: '#' + tp.tag, d: tp.name, topic: tp.id })), ...labelsAll.map(l => ({ k: '#' + l, d: 'label' }))].filter(x => x.k.toLowerCase().startsWith(t));
    else acList = ctxAll.filter(x => x.toLowerCase().startsWith(t)).map(x => ({ k: x, d: 'context · syncs to Weekly Focus' }));
    acList = acList.slice(0, 7); }
  const acI = acList.length ? ((acIdx % acList.length) + acList.length) % acList.length : 0;

  // Caret moves right after React commits the new text, so fast typing never lands before it.
  const pendingCaret = useRef<number | null>(null);
  useLayoutEffect(() => { const pos = pendingCaret.current, e = el.current; if (pos == null || !e) return; pendingCaret.current = null; e.focus(); e.setSelectionRange(pos, pos); });
  const placeCaret = (pos: number) => { pendingCaret.current = pos; };
  const applyAc = (item: AcItem) => {
    if (!ac) return; const cp = Math.min(caret, text.length), start = cp - ac.tok.length; let head = text.slice(0, start), after = text.slice(cp), pos: number; const nf = { ...flags };
    if (ac.kind === '/') { const k = item.k.slice(1);
      if (k === 'todo') { head += '- [ ] '; pos = head.length; }
      else if (TEMPLATES[k]) { const tpl = TEMPLATES[k](); if (!(head + after).trim()) { head = tpl; after = ''; pos = templateCaret(k, tpl); } else { head += tpl; pos = head.length; } }
      else { nf[item.flag!] = !nf[item.flag!]; pos = head.length; } }
    else { head += item.k + ' '; if (item.topic) setTopicOv(item.topic); pos = head.length; }
    setText(head + after); setFlags(nf); setCaret(pos); setAcIdx(0); placeCaret(pos);
  };

  const stopVoice = () => { clearInterval(voiceT.current); try { rec.current?.stop(); } catch { /* ok */ } rec.current = null; setListening(false); };
  const toggleVoice = () => {
    if (listening) { stopVoice(); return; }
    const base = text ? text.replace(/\s*$/, '\n') : '';
    const simulate = () => { let i = 0; clearInterval(voiceT.current); setListening(true); voiceT.current = setInterval(() => { i += 2; setText(base + VOICE_DEMO.slice(0, i)); if (i >= VOICE_DEMO.length) { clearInterval(voiceT.current); setListening(false); } }, 45); };
    const W = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }; const Ctor = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!Ctor) { simulate(); return; }
    try { const r = new Ctor(); rec.current = r; r.interimResults = true; r.continuous = true; r.lang = navigator.language || 'en-US';
      r.onresult = ev => { let t = ''; for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript; setText(base + t); };
      r.onerror = () => { rec.current = null; simulate(); }; r.onend = () => { if (rec.current === r) setListening(false); };
      r.start(); setListening(true); } catch { simulate(); }
  };

  const save = async () => {
    if (!text.trim()) return; const f = flags;
    const r = await captureNote(text, { topic: topicOv, asList: listOv, flags: f, img }, index, open); if (!r) return;
    const bits = ['Saved to ' + topicName(r.note.topic)]; if (f.pin) bits.push('pinned'); if (r.note.vault) bits.push('in vault');
    if (r.wfItem) bits.push(r.todos + (r.todos === 1 ? ' to-do' : ' to-dos') + ' → ' + r.wfItem); else if (r.todos) bits.push(r.todos + (r.todos === 1 ? ' to-do' : ' to-dos'));
    stopVoice(); setText(''); setCaret(0); setFlags({}); setTopicOv(null); setListOv(null); setImg(null); setAcDismiss(false);
    const id = r.note.id; st.showToast({ id, msg: bits.join(' · '), undo: () => void useStore.getState().removeNote(id) });
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (ac && acList.length && !e.metaKey && !e.ctrlKey) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setAcIdx(acI + 1); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setAcIdx(acI - 1); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); applyAc(acList[acI]); return; }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setAcDismiss(true); return; }
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void save(); return; }
    if (e.key === 'Escape') { e.stopPropagation(); e.currentTarget.blur(); }
  };
  const onPaste = (e: React.ClipboardEvent) => {
    for (const it of Array.from(e.clipboardData?.items || [])) { if (it.type?.startsWith('image/')) { const file = it.getAsFile(); if (!file) continue; e.preventDefault();
      const r = new FileReader(); r.onload = () => setImg(r.result as string); r.readAsDataURL(file); return; } }
  };

  const tN = st.toast && all.find(n => n.id === st.toast!.id);
  const expanded = focus && text.trim().length > 0;
  // With a note open the toast sits above the sheet (the composer is under its backdrop).
  const toastEl = st.toast && tN && <div role="status" style={{ alignSelf: 'center', pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 10, padding: '7px 7px 7px 16px', borderRadius: 999, background: 'var(--ink)', color: 'var(--bg)', fontSize: 13, boxShadow: '0 10px 30px rgba(0,0,0,.2)', animation: 'siftin .2s ease-out', maxWidth: '100%' }}>
    <span style={{ width: 8, height: 8, borderRadius: '50%', background: topicColor(tN.topic, dark), flex: 'none' }} />
    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{st.toast.msg}</span>
    {st.selId !== tN.id && <button onClick={() => { st.showToast(null); st.openNote(tN.id); }} style={{ border: 0, background: 'transparent', color: 'var(--bg)', fontSize: 12, padding: '4px 8px', opacity: .75 }}>Open</button>}
    {st.toast.undo && <button onClick={() => { const u = st.toast?.undo; st.showToast(null); u?.(); }} style={{ border: 0, borderRadius: 999, background: 'var(--bg)', color: 'var(--ink)', fontSize: 12, padding: mobile ? '0 16px' : '5px 12px', minHeight: mobile ? 44 : undefined }}>Undo</button>}
  </div>;
  const toast = toastEl && st.selId ? createPortal(<div style={{ position: 'fixed', left: 0, right: 0, bottom: mobile ? 16 : 24, zIndex: 60, display: 'flex', justifyContent: 'center', padding: '0 10px', pointerEvents: 'none' }}>{toastEl}</div>, document.body) : toastEl;
  const keep = (fn: () => void) => (e: React.PointerEvent) => { e.preventDefault(); fn(); }; // pointerdown + preventDefault keeps the textarea focused
  const wfTarget = suggestItem(Object.values(st.wf), topic);
  const pvFlags = [...(flags.pin ? ['Pinned'] : []), ...(flags.vault || topic === 'career' ? ['Vault'] : []), ...(flags.wf ? [pd.todos.length ? '→ ' + (wfTarget ?? 'no Weekly Focus item') : 'WF · add a to-do'] : [])];

  return <div style={{ position: 'fixed', left: '50%', bottom: mobile ? 78 : 20, transform: 'translateX(-50%)', width: mobile ? 'calc(100% - 20px)' : 'min(760px, calc(100% - 48px))', zIndex: 45, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
    {toast}
    {expanded && <div style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 16px', border: '1px solid var(--ln)', borderRadius: 18, background: 'var(--sf)', boxShadow: '0 18px 50px rgba(0,0,0,.12)', maxHeight: '36vh', overflow: 'auto', animation: 'siftin .18s ease-out' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--mu)' }}>Preview</span>
        <button className="h-ac" title="Tap to change topic" onPointerDown={keep(() => { const ids = TOPICS.map(t => t.id); setTopicOv(ids[(ids.indexOf(topic) + 1) % ids.length]); })}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px', border: '1px solid var(--ln)', borderRadius: 999, background: 'var(--bg)', fontSize: 12 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: topicColor(topic, dark) }} />{topicName(topic)}<span style={{ fontFamily: MONO, fontSize: 9, color: 'var(--ac)' }}>{topicTag}</span>
        </button>
        {pvFlags.map(f => <span key={f} style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.04em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 999, background: 'var(--ac)', color: 'var(--acink)' }}>{f}</span>)}
        {(pd.detected || listOv === true) && <button onPointerDown={keep(() => setListOv(!pd.list))} style={{ marginLeft: 'auto', padding: '3px 10px', border: `1px solid ${pd.list ? c.ac : c.ln}`, borderRadius: 999, background: pd.list ? c.ac : 'transparent', color: pd.list ? c.acink : c.ink, fontSize: 11 }}>{pd.list ? 'Checklist ✓' : 'Make checklist'}</button>}
      </div>
      <h3 style={{ margin: 0, fontFamily: SERIF, fontSize: 21, fontWeight: 400, letterSpacing: '-.01em', lineHeight: 1.2 }}>{pd.title}</h3>
      {pd.labels.length + pd.ctx.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{[...pd.labels.map(l => '#' + l), ...pd.ctx].map(t => <span key={t} style={{ fontFamily: MONO, fontSize: 11, padding: '2px 8px', borderRadius: 5, background: 'var(--acs)', color: 'var(--ac)' }}>{t}</span>)}</div>}
      {pd.todos.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {pd.todos.slice(0, 4).map((t, i) => <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'center', fontSize: 14 }}><span style={{ width: 14, height: 14, borderRadius: '50%', border: '1.5px solid var(--mu)', flex: 'none' }} />{t}</div>)}
        {pd.todos.length > 4 && <span style={{ fontSize: 12, color: 'var(--mu)' }}>+{pd.todos.length - 4} more</span>}
      </div>}
      {pd.links.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {pd.links.map((l, i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: '36px 1fr', gap: 10, alignItems: 'center', padding: '8px 10px', border: '1px solid var(--ln)', borderRadius: 10, background: 'var(--bg)' }}>
          <span style={{ width: 36, height: 36, borderRadius: 8, background: `oklch(0.6 0.13 ${LINK_HUES[i % LINK_HUES.length]})`, color: '#fff', display: 'grid', placeItems: 'center', fontFamily: SERIF, fontSize: 18 }}>{l.domain[0]?.toUpperCase()}</span>
          <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}><span style={{ fontSize: 13, fontWeight: 500 }}>{l.domain}</span><span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--mu)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.path}</span></span>
        </div>)}
      </div>}
      {img && <div style={{ position: 'relative', alignSelf: 'flex-start' }}>
        <div role="img" aria-label="Pasted image" style={{ width: 180, height: 120, borderRadius: 10, border: '1px solid var(--ln)', background: `var(--bg) url("${img}") center/contain no-repeat` }} />
        <button onPointerDown={keep(() => setImg(null))} aria-label="Remove image" style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', border: 0, background: 'var(--ink)', color: 'var(--bg)', fontSize: 13, lineHeight: 1 }}>×</button>
      </div>}
      {sug.related.length > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid var(--ln)' }}>
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--mu)', marginRight: 2 }}>Links to</span>
        {sug.related.map(x => <span key={x.n.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 6, background: 'var(--bg)', fontSize: 12 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: topicColor(x.n.topic, dark) }} />{x.n.title}<span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--mu)' }}>{Math.round(x.sim * 100)}%</span></span>)}
      </div>}
    </div>}
    {ac && acList.length > 0 && <div style={{ pointerEvents: 'auto', alignSelf: 'flex-start', width: 'min(340px,100%)', padding: 6, border: '1px solid var(--ln)', borderRadius: 14, background: 'var(--sf)', boxShadow: '0 18px 50px rgba(0,0,0,.16)', animation: 'siftin .14s ease-out' }}>
      <div style={{ padding: '6px 10px 4px', fontFamily: MONO, fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--mu)' }}>{ac.kind === '/' ? 'Commands' : ac.kind === '#' ? 'Topic or label' : 'Context'}</div>
      {acList.map((x, i) => <button key={x.k} onPointerDown={keep(() => applyAc(x))} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', border: 0, borderRadius: 9, background: i === acI ? c.acs : 'transparent', textAlign: 'left' }}>
        <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--ac)', minWidth: 96 }}>{x.k}</span><span style={{ fontSize: 13, color: 'var(--mu)' }}>{x.d}</span></button>)}
      <div style={{ padding: '6px 10px 2px', fontSize: 11, color: 'var(--mu)', borderTop: '1px solid var(--ln)', marginTop: 4 }}>↑↓ move · Enter pick · Esc close</div>
    </div>}
    <div style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'column', border: `1px solid ${focus ? c.ac : c.ln}`, borderRadius: 24, background: 'var(--sf)', boxShadow: focus ? '0 22px 60px rgba(0,0,0,.18)' : '0 10px 30px rgba(0,0,0,.10)', transition: 'border-color .2s,box-shadow .2s' }}>
      {focus && !text && <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '12px 14px 0' }}>
        <span style={{ fontSize: 12, color: 'var(--mu)', marginRight: 2 }}>Start from</span>
        {Object.keys(TEMPLATES).map(k => <button key={k} className="h-acc" onPointerDown={keep(() => { const tpl = TEMPLATES[k](); const pos = templateCaret(k, tpl); setText(tpl); setCaret(pos); placeCaret(pos); })}
          style={{ padding: '4px 11px', border: '1px solid var(--ln)', borderRadius: 999, background: 'var(--bg)', fontSize: 12 }}>{k[0].toUpperCase() + k.slice(1)}</button>)}
        {!mobile && <span style={{ fontSize: 12, color: 'var(--mu)', marginLeft: 'auto' }}>⌘/Ctrl + Enter saves</span>}
      </div>}
      {focus && <div className="noscroll" role="radiogroup" aria-label="Topic" style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', padding: '12px 14px 0' }}>
        <span style={{ fontSize: 12, color: 'var(--mu)', marginRight: 2, flex: 'none' }}>Topic</span>
        {TOPICS.map(tp => { const on = topic === tp.id, picked = on && topicOv === tp.id;
          return <button key={tp.id} role="radio" aria-checked={on} onPointerDown={keep(() => setTopicOv(picked ? null : tp.id))}
            style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 6, padding: mobile ? '6px 11px' : '4px 11px', border: `1px solid ${on ? c.ac : c.ln}`, borderRadius: 999, background: picked ? c.ac : on ? c.acs : c.bg, color: picked ? c.acink : c.ink, fontSize: 12 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: picked ? c.acink : topicColor(tp.id, dark) }} />{tp.name}
            {on && !picked && topicTag && <span style={{ fontFamily: MONO, fontSize: 9, color: 'var(--ac)' }}>{topicTag}</span>}</button>; })}
        <button onPointerDown={e => { e.preventDefault(); st.set({ topicsOpen: true }); }} aria-label="Add or edit topics"
          style={{ flex: 'none', padding: mobile ? '6px 11px' : '4px 11px', border: '1px dashed var(--ln)', borderRadius: 999, background: 'transparent', color: 'var(--mu)', fontSize: 12 }}>+ Topic</button>
      </div>}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, padding: '8px 8px 8px 18px' }}>
        <textarea ref={e => { el.current = e; registerComposer(e); }} value={text} rows={focus ? Math.min(8, Math.max(1, text.split('\n').length)) : 1} aria-label="Write a note"
          onChange={e => { setText(e.target.value); setCaret(e.target.selectionStart); setAcDismiss(false); setAcIdx(0); }}
          onSelect={e => setCaret(e.currentTarget.selectionStart)} onKeyDown={onKey} onPaste={onPaste}
          onFocus={() => { clearTimeout(blurT.current); setFocus(true); }} onBlur={() => { clearTimeout(blurT.current); blurT.current = setTimeout(() => setFocus(false), 160); }}
          placeholder={focus ? (mobile ? 'Write… / # @' : 'Write… type / for commands, # for topic, @ for context') : (mobile ? 'Write a note' : 'Write a note…   press N')}
          style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', outline: 'none', resize: 'none', padding: '8px 0', fontFamily: SERIF, fontSize: 17, lineHeight: 1.45, maxHeight: '40vh' }} />
        <button onPointerDown={keep(() => { if (!focus) el.current?.focus(); toggleVoice(); })} title={listening ? 'Listening… tap to stop' : 'Dictate'} aria-label="Dictate"
          style={{ width: 38, height: 38, flex: 'none', borderRadius: '50%', border: `1px solid ${listening ? c.ac : c.ln}`, background: listening ? c.ac : 'transparent', color: listening ? c.acink : c.mu, display: 'grid', placeItems: 'center' }}>
          <span style={{ width: 9, height: 13, borderRadius: 5, border: '1.5px solid currentColor', animation: listening ? 'siftpulse 1s ease-in-out infinite' : 'none' }} />
        </button>
        <button onPointerDown={keep(() => void save())} disabled={!text.trim()} style={{ height: 38, flex: 'none', padding: '0 16px', borderRadius: 999, border: 0, background: text.trim() ? c.ink : c.sf2, color: text.trim() ? c.bg : c.mu, fontSize: 13, transition: 'background .2s' }}>Save</button>
      </div>
    </div>
  </div>;
}
