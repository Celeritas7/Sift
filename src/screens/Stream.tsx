import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useStore } from '../state/store';
import { useAmbientPool, useConflicts, useIsMobile, useNotes, useOwnHighlights, usePalette, type NoteV } from '../state/derived';
import { useWeeks, useWfStats } from '../state/counts';
import { DEFAULT_STREAM, MONO, NO_AI, SERIF, TOPICS, topicColor } from '../lib/config';
import { ago, DOW, fmtShort, MONTHS, plural } from '../lib/format';
import { focusComposer } from '../state/focus';
import { Chip, Eyebrow, inkBtn, pill, Switch } from '../components/ui';
import { SwipeRow } from '../components/SwipeRow';
import { segStyle } from '../components/CollageText';
import { hl, marker } from '../lib/collage';
import { pickExcerpt, type Excerpt } from '../lib/parse';
import type { StreamSettings } from '../types';
import type { Anchored } from '../lib/highlights';

export function NoteChips({ n, conflict, labels = true }: { n: NoteV; conflict?: boolean; labels?: boolean }) {
  const unlocked = useStore(s => s.unlocked);
  return <>
    {n.vault && <Chip t={unlocked ? 'Vault · open' : 'Vault'} strong={!unlocked} />}
    {conflict && <Chip t="Conflict" strong />}
    {labels && !n.hidden && n.labels.map(l => <Chip key={l} t={l} />)}
  </>;
}

function Resurface() {
  const pool = useAmbientPool(); const openNote = useStore(s => s.openNote); const ambient = useStore(s => s.ambient);
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * 5)); const [fade, setFade] = useState(false);
  useEffect(() => { if (ambient) return; const t = setInterval(() => { setFade(true); setTimeout(() => { setIdx(i => i + 1); setFade(false); }, 480); }, 9000); return () => clearInterval(t); }, [ambient]);
  const k = Math.min(pool.length, 5); if (!k) return null; const n = pool[idx % k];
  return <button className="h-ac" onClick={() => openNote(n.id)} style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', gap: 18, alignItems: 'center', padding: '14px 18px', border: '1px solid var(--ln)', borderRadius: 16, background: 'var(--sf)', textAlign: 'left', opacity: fade ? 0 : 1, transform: fade ? 'translateY(-4px)' : 'none', transition: 'opacity .45s,transform .45s' }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontFamily: MONO, fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--mu)' }}>
      <span style={{ color: 'var(--ac)' }}>From your past</span><span>{ago(n.ts)}</span>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span style={{ fontFamily: SERIF, fontSize: 18, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title || 'Untitled'}</span>
      <span style={{ fontSize: 13, color: 'var(--mu)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.sum}</span>
    </div>
    <div style={{ display: 'flex', gap: 4 }}>{Array.from({ length: k }, (_, i) => <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: i === idx % k ? 'var(--ac)' : 'var(--ln)', transition: 'background .3s' }} />)}</div>
  </button>;
}

function Hero() {
  const st = useStore(); const { c } = usePalette(); const mobile = useIsMobile(); const wf = useWfStats(); const { weeks, current } = useWeeks();
  const { active } = useNotes(); const pinned = active.filter(n => n.pinned && !n.hidden);
  return <section style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'minmax(0,1.3fr) minmax(0,1fr)', gap: mobile ? 22 : 56, alignItems: 'end', paddingBottom: mobile ? 28 : 44, borderBottom: '1px solid var(--ln)' }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Eyebrow><span>{current ? 'Week of ' + current.label : 'This week'}</span><span>·</span><span>{plural(current?.notes.length ?? 0, 'note')}</span></Eyebrow>
      <p style={{ margin: 0, fontFamily: SERIF, fontSize: mobile ? 26 : 36, fontWeight: 300, lineHeight: 1.28, letterSpacing: '-.015em', textWrap: 'pretty', whiteSpace: 'pre-line', maxWidth: '28ch' }}>
        {current?.digest || 'No digest for this week yet.'}</p>
      <button className="h-ac" onClick={() => st.go('week')} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px 6px 6px', border: '1px solid var(--ln)', borderRadius: 999, background: 'var(--sf)', fontSize: 13 }}>
        <span style={{ width: 22, height: 22, borderRadius: '50%', background: `conic-gradient(var(--ac) ${wf.pct}%, var(--sf2) 0)`, display: 'grid', placeItems: 'center' }}><span style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--sf)' }} /></span>
        <span>{wf.line}</span>
      </button>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button disabled title={NO_AI} style={{ ...inkBtn, opacity: .45 }}>Write digest</button>
        <div className="noscroll" style={{ display: 'flex', gap: 2, overflowX: 'auto', padding: 2 }}>
          {weeks.map(w => { const on = current?.id === w.id; return <button key={w.id} className="h-ac" onClick={() => st.set({ week: w.id })} title={'Week of ' + w.label}
            style={{ width: 26, height: 26, borderRadius: '50%', border: `1px solid ${on ? c.ink : c.ln}`, background: on ? c.ink : 'transparent', display: 'grid', placeItems: 'center', flex: 'none' }}>
            <span style={{ width: w.digest ? 8 : 4, height: w.digest ? 8 : 4, borderRadius: '50%', background: on ? c.bg : w.digest ? c.ac : c.mu, display: 'inline-block', transition: 'all .2s' }} />
          </button>; })}
        </div>
        <span style={{ fontSize: 12, color: 'var(--mu)' }}>{NO_AI}</span>
      </div>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      <button className="h-write" onClick={() => { st.set({ selId: null }); focusComposer(); }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', border: '1px solid var(--ac)', borderRadius: 14, background: 'var(--acs)', textAlign: 'left' }}>
        <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--ac)', color: 'var(--acink)', display: 'grid', placeItems: 'center', fontSize: 18, lineHeight: 1, flex: 'none' }}>+</span>
        <span style={{ flex: 1, fontFamily: SERIF, fontSize: 18 }}>Write something</span>
        <span style={{ fontFamily: MONO, fontSize: 11, padding: '2px 7px', borderRadius: 5, border: '1px solid var(--ln)', color: 'var(--mu)', background: 'var(--sf)' }}>N</span>
      </button>
      {pinned.length > 0 && <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--mu)', marginTop: 6 }}>Pinned</div>}
      {pinned.map(n => <button key={n.id} className="h-ac" onClick={() => st.openNote(n.id)} style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '12px 14px', border: '1px solid var(--ln)', borderRadius: 12, background: 'var(--sf)', textAlign: 'left', minWidth: 0 }}>
        <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--mu)', flex: 'none' }}>{fmtShort(n.ts)}</span>
        <span style={{ fontFamily: SERIF, fontSize: 16, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title || 'Untitled'}</span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--ac)', flex: 'none' }}>{n.lang}</span>
      </button>)}
    </div>
  </section>;
}

/** The user's own highlights on a Stream card: up to two quotes in their marker colour. */
function OwnQuotes({ body, own }: { body: string; own: Anchored[] }) {
  const { dark } = usePalette();
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: '68ch' }}>
    {own.slice(0, 2).map(h => { const q = body.slice(h.s, h.e).replace(/\s+/g, ' ').trim();
      return <p key={h.id} style={{ margin: 0, fontFamily: SERIF, fontSize: 15, lineHeight: 1.55 }}>
        <span style={segStyle({ t: q, kind: 'own', color: h.color }, 'marker', dark)}>{q.length > 140 ? q.slice(0, 140) + '…' : q}</span></p>; })}
    {own.length > 2 && <span style={{ fontSize: 12, color: 'var(--mu)' }}>+{plural(own.length - 2, 'more highlight')}</span>}
  </div>;
}

/** One sentence from the body under the summary; search hits get the yellow Collage marker. */
function ExcerptLine({ x }: { x: Excerpt }) {
  const { dark } = usePalette(); const mobile = useIsMobile();
  const parts: { t: string; hit: boolean }[] = []; let at = 0;
  x.hits.forEach(([a, b]) => { if (a > at) parts.push({ t: x.text.slice(at, a), hit: false }); parts.push({ t: x.text.slice(a, b), hit: true }); at = b; });
  if (at < x.text.length) parts.push({ t: x.text.slice(at), hit: false });
  const hit: CSSProperties = { background: marker(hl(0, 'sticky', dark)), mixBlendMode: dark ? 'normal' : 'multiply', padding: '0 1px', boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' };
  const clamp: CSSProperties = mobile ? { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } : { whiteSpace: 'nowrap', textOverflow: 'ellipsis' };
  return <p style={{ margin: 0, fontFamily: SERIF, fontStyle: 'italic', fontSize: 15, lineHeight: 1.5, color: 'var(--ink)', opacity: .8, maxWidth: '68ch', overflow: 'hidden', ...clamp }}>
    {parts.map((p, i) => p.hit ? <span key={i} style={hit}>{p.t}</span> : p.t)}</p>;
}

export function NoteRow({ n, conflict, own = [], excerpt = null }: { n: NoteV; conflict: boolean; own?: Anchored[]; excerpt?: Excerpt | null }) {
  const st = useStore(); const mobile = useIsMobile(); const d = new Date(n.ts); const wc = n.body.trim().split(/\s+/).filter(Boolean).length;
  const swipe = mobile && !n.hidden;
  const row = <article onClick={() => st.openNote(n.id)} className="h-sf" style={{ display: 'grid', gridTemplateColumns: mobile ? '40px minmax(0,1fr)' : '56px minmax(0,1fr) 80px', gap: mobile ? 12 : 20, padding: '18px 14px', margin: swipe ? 0 : '0 -14px', borderTop: '1px solid var(--ln)', borderRadius: 12, cursor: 'pointer', transition: 'background .15s' }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontFamily: MONO, fontSize: 11, color: 'var(--mu)', lineHeight: 1.4 }}>
      <span style={{ color: 'var(--ink)', fontSize: 13 }}>{d.getDate()}</span><span>{DOW[d.getDay()]}</span>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontFamily: SERIF, fontSize: mobile ? 19 : 22, fontWeight: 400, lineHeight: 1.2, letterSpacing: '-.01em', textWrap: 'pretty', color: n.hidden ? 'var(--mu)' : 'var(--ink)', fontStyle: n.hidden ? 'italic' : 'normal' }}>{n.hidden ? 'Locked note' : n.title || 'Untitled'}</h3>
        <NoteChips n={n} conflict={conflict} />
      </div>
      <p style={{ margin: 0, color: 'var(--mu)', fontSize: 14, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', maxWidth: '68ch' }}>{n.hidden ? 'In your vault. Enter your PIN to read it.' : n.sum}</p>
      {!n.hidden && !own.length && excerpt && <ExcerptLine x={excerpt} />}
      {!n.hidden && own.length > 0 && <OwnQuotes body={n.body} own={own} />}
      {!n.hidden && n.todoList.length > 0 && <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--ac)' }}>
        <span style={{ width: 10, height: 10, border: '1.5px solid var(--ac)', borderRadius: 3, display: 'inline-block' }} />{plural(n.todoList.length, 'to-do')}</div>}
    </div>
    {!mobile && <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--mu)', textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
      <span style={{ color: 'var(--ac)' }}>{n.hidden ? 'VAULT' : n.lang}</span><span>{n.hidden ? '' : wc < 2 ? '1 line' : wc + ' words'}</span>
    </div>}
  </article>;
  if (!swipe) return row;
  const pin = () => { const was = n.pinned; void st.updateNote(n.id, { pinned: !was }); st.showToast({ id: n.id, msg: was ? 'Unpinned' : 'Pinned', undo: () => void useStore.getState().updateNote(n.id, { pinned: was }) }); };
  const archive = () => { void st.updateNote(n.id, { archived: true }); st.showToast({ id: n.id, msg: 'Archived', undo: () => void useStore.getState().updateNote(n.id, { archived: false }) }); };
  return <SwipeRow pinned={n.pinned} onPin={pin} onArchive={archive} style={{ margin: '0 -14px' }}>{row}</SwipeRow>;
}

const ROW_LIMIT = 8;
const mdy = (t: number) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
interface Group { key: string; label: string; dot?: string; meta: string; rows: NoteV[]; limit: boolean; }

/** A month or topic: sticky label on the left (above the rows on a phone), rows on the right, optionally capped with "Show all N". */
function GroupSection({ g, rowOf }: { g: Group; rowOf: (n: NoteV) => ReactNode }) {
  const mobile = useIsMobile(); const [all, setAll] = useState(false);
  const rows = g.limit && !all ? g.rows.slice(0, ROW_LIMIT) : g.rows;
  return <section style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '180px minmax(0,1fr)', gap: mobile ? 10 : 32, alignItems: 'start' }}>
    <div style={{ position: mobile ? 'static' : 'sticky', top: 84, display: 'flex', flexDirection: mobile ? 'row' : 'column', flexWrap: 'wrap', gap: mobile ? 10 : 6, alignItems: 'baseline' }}>
      <span style={{ fontFamily: SERIF, fontSize: mobile ? 32 : 52, fontWeight: 300, lineHeight: .95, letterSpacing: '-.03em' }}>
        {g.dot && <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: g.dot, marginRight: 10, verticalAlign: 'middle' }} />}{g.label}</span>
      <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--mu)' }}>{g.meta}</span>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {rows.map(rowOf)}
      {rows.length < g.rows.length && <button className="h-ac" onClick={() => setAll(true)} style={{ alignSelf: 'flex-start', marginTop: 8, padding: '6px 14px', minHeight: mobile ? 44 : undefined, border: '1px solid var(--ln)', borderRadius: 999, background: 'transparent', fontSize: 12 }}>Show all {g.rows.length}</button>}
    </div>
  </section>;
}

export function Stream() {
  const st = useStore(); const { c, dark } = usePalette(); const { all, active, df } = useNotes(); const conflicts = useConflicts(); const ownBy = useOwnHighlights();
  const conflictIds = useMemo(() => new Set(conflicts.flatMap(p => [p.a, p.b])), [conflicts]);
  const cfg: StreamSettings = { ...DEFAULT_STREAM, ...(st.settings.stream ?? {}) };
  const setCfg = (p: Partial<StreamSettings>) => void st.setSettings({ stream: { ...cfg, ...p } });
  const isCmd = st.query.startsWith('/'), q = isCmd ? '' : st.query.trim().toLowerCase();
  const visible = active.filter(n => (n.hidden ? !q : !q || (n.title + ' ' + n.body + ' ' + n.sum).toLowerCase().includes(q)) && (st.filter === 'all' || n.topic === st.filter || n.labels.includes(st.filter)));
  const filterTopic = TOPICS.find(t => t.id === st.filter);
  const filterLabel = filterTopic?.name ?? '#' + st.filter;

  const groups: Group[] = [];
  if (cfg.group === 'topic') {
    const byPin = (a: NoteV, b: NoteV) => (+b.pinned - +a.pinned) || b.ts - a.ts;
    const meta = (rows: NoteV[]) => plural(rows.length, 'note') + ' · latest ' + mdy(Math.max(...rows.map(n => n.ts)));
    const known = new Set(TOPICS.map(t => t.id as string));
    if (filterTopic) { // one topic picked: a single section, locked notes included, no cap
      if (visible.length) groups.push({ key: filterTopic.id, label: filterTopic.name, dot: topicColor(filterTopic.id, dark), meta: meta(visible), rows: [...visible].sort(byPin), limit: false });
    } else {
      TOPICS.forEach(t => {
        const rows = visible.filter(n => !n.hidden && (known.has(n.topic) ? n.topic === t.id : t.id === 'scrap')).sort(byPin);
        if (rows.length) groups.push({ key: t.id, label: t.name, dot: topicColor(t.id, dark), meta: meta(rows), rows, limit: true });
      });
      const locked = visible.filter(n => n.hidden).sort(byPin);
      if (locked.length) groups.push({ key: 'vault', label: 'Vault', dot: c.mu, meta: plural(locked.length, 'locked note'), rows: locked, limit: true });
    }
  } else visible.forEach(n => {
    const d = new Date(n.ts), key = d.getFullYear() + '-' + d.getMonth(); let m = groups.find(x => x.key === key);
    if (!m) { m = { key, label: MONTHS[d.getMonth()], meta: String(d.getFullYear()), rows: [], limit: false }; groups.push(m); }
    m.rows.push(n);
  });
  if (cfg.group === 'month') groups.forEach(m => { m.meta += ' · ' + plural(m.rows.length, 'note'); });

  const rowOf = (n: NoteV) => {
    const own = ownBy[n.id]; const x = cfg.excerpt && !n.hidden && !own?.length ? pickExcerpt(n.body, n.sum, q, df) : null;
    return <NoteRow key={n.id} n={n} conflict={conflictIds.has(n.id)} own={own} excerpt={x} />;
  };

  if (!all.length) return <>
    <Hero />
    <section style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 560 }}>
      <p style={{ margin: 0, fontFamily: SERIF, fontSize: 24, fontWeight: 300, fontStyle: 'italic', color: 'var(--mu)' }}>No notes yet. Bring in your Google Keep notes, or write one below.</p>
      <button onClick={() => st.set({ importOpen: true })} style={{ ...inkBtn, alignSelf: 'flex-start' }}>Import from Google Takeout</button>
    </section>
  </>;

  return <>
    <Resurface />
    <Hero />
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      {st.filter !== 'all' && <>
        <span style={{ fontSize: 13, color: 'var(--mu)' }}>Showing</span>
        <span style={{ padding: '5px 12px', borderRadius: 999, background: 'var(--ink)', color: 'var(--bg)', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>{filterLabel}
          <button onClick={() => st.set({ filter: 'all' })} aria-label="Clear filter" style={{ border: 0, background: 'transparent', color: 'var(--bg)', padding: 0, lineHeight: 1, opacity: .7 }}>×</button></span>
        <span style={{ fontSize: 13, color: 'var(--mu)' }}>{plural(visible.length, 'note')}</span>
      </>}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={pill}><button aria-pressed={cfg.excerpt} onClick={() => setCfg({ excerpt: !cfg.excerpt })} title="A sentence from each note under its summary"
          style={{ padding: '5px 12px', border: 0, borderRadius: 999, background: cfg.excerpt ? c.ink : 'transparent', color: cfg.excerpt ? c.bg : c.ink, fontSize: 12 }}>Excerpts</button></div>
        <Switch label="Group by" value={cfg.group} opts={[['month', 'Month'], ['topic', 'Topic']]} onPick={group => setCfg({ group })} />
      </div>
    </div>
    {groups.map(g => <GroupSection key={cfg.group + ':' + g.key} g={g} rowOf={rowOf} />)}
    {!visible.length && <p style={{ margin: 0, fontFamily: SERIF, fontSize: 24, fontWeight: 300, fontStyle: 'italic', color: 'var(--mu)' }}>Nothing here. Clear the search or filter.</p>}
  </>;
}
