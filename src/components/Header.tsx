import { useEffect, useRef } from 'react';
import { useStore, type View } from '../state/store';
import { useIsMobile, useMedia, useNotes, usePalette } from '../state/derived';
import { useCounts } from '../state/counts';
import { MONO, SERIF, topicColor } from '../lib/config';
import { fmtShort } from '../lib/format';
import { focusComposer } from '../state/focus';
import { cloud, signOut } from '../lib/supabase';
import { AI_READY } from '../lib/ai';

export const NAV: { id: View; label: string; mobile?: string }[] = [
  { id: 'stream', label: 'Stream' }, { id: 'week', label: 'Week' }, { id: 'map', label: 'Map' }, { id: 'collage', label: 'Collage' }, { id: 'chat', label: 'Chat' }, { id: 'lens', label: 'Lens' },
  { id: 'todos', label: 'To-dos' }, { id: 'conflicts', label: 'Conflicts', mobile: 'Dupes' },
];

export function useNavItems() {
  const counts = useCounts();
  return NAV.map(n => ({ ...n, count: n.id === 'week' ? counts.week : n.id === 'todos' ? counts.todos : n.id === 'conflicts' ? counts.conflicts : 0 }));
}

export function useCommands() {
  const st = useStore(); const { dark } = usePalette(); const { open } = useNotes();
  const unsummed = AI_READY && !st.aiBulk ? open.filter(n => !n.vault && !n.summary).map(n => n.id) : [];
  const cmds = [
    { key: '/new', label: 'Write a note', run: () => { st.set({ query: '', selId: null }); focusComposer(); } },
    { key: '/week', label: 'Weekly Focus board', run: () => st.go('week') },
    { key: '/map', label: 'Relevance map', run: () => st.go('map') },
    { key: '/collage', label: 'Collage of your writing', run: () => st.go('collage') },
    { key: '/chat', label: 'Your topics as a group chat', run: () => st.go('chat') },
    { key: '/ambient', label: 'Start ambient mode', run: () => st.set({ query: '', ambient: true }) },
    { key: '/vault', label: st.unlocked ? 'Lock the vault' : 'Unlock the vault', run: () => { st.set({ query: '' }); if (st.unlocked) st.lock(); else st.askPin(); } },
    { key: '/todos', label: 'Open to-dos', run: () => st.go('todos') },
    { key: '/topics', label: 'Add, rename or recolour topics', run: () => st.set({ query: '', topicsOpen: true }) },
    { key: '/import', label: 'Import from Google Takeout', run: () => st.set({ importOpen: true, query: '' }) },
    { key: '/archive', label: 'Archive', run: () => st.go('archive') },
    { key: dark ? '/light' : '/dark', label: 'Switch theme', run: () => { st.set({ query: '' }); void st.setSettings({ theme: dark ? 'light' : 'dark' }); } },
    { key: '/excerpts', label: (st.settings.stream?.excerpt ?? true) ? 'Hide excerpts in the stream' : 'Show excerpts in the stream', run: () => { st.set({ query: '' }); void st.setSettings({ stream: { ...st.settings.stream, excerpt: !(st.settings.stream?.excerpt ?? true) } }); } },
    ...(unsummed.length ? [{ key: '/summarize', label: `Summarise ${unsummed.length} note${unsummed.length === 1 ? '' : 's'} without a summary (Claude)`, run: () => { st.set({ query: '' }); void st.summarizeNotes(unsummed, true); } }] : []),
    { key: '/pin', label: st.hasPin ? 'Change vault PIN' : 'Set a vault PIN', run: () => { st.set({ query: '' }); st.askPin(null, 'set'); } },
    ...(cloud ? [{ key: '/signout', label: 'Sign out', run: () => void signOut() }] : []),
  ];
  const q = st.query.toLowerCase();
  return cmds.filter(c => q === '/' || c.key.startsWith(q));
}

export function Header() {
  const st = useStore(); const { c, dark } = usePalette(); const mobile = useIsMobile();
  // Between phone and wide desktop the nav pill doesn't fit beside the search: it takes its own row and scrolls sideways if needed.
  const twoRow = useMedia('(min-width: 431px) and (max-width: 1099px)'), compact = useMedia('(max-width: 599px)');
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => { if (twoRow) navRef.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, [st.view, twoRow]);
  const { active, lockedCount } = useNotes(); const nav = useNavItems(); const cmds = useCommands();
  const isCmd = st.query.startsWith('/'), q = isCmd ? '' : st.query.trim().toLowerCase();
  const hits = q ? active.filter(n => !n.hidden && (n.title + ' ' + n.body + ' ' + n.sum + ' ' + (n.summary_orig || '')).toLowerCase().includes(q)).slice(0, 6) : [];
  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') { if (isCmd && cmds[0]) cmds[0].run(); else if (hits[0]) st.openNote(hits[0].id); } };
  // On narrow screens the search box is too thin for its dropdown, so the dropdown spans the header instead.
  const wide = !(mobile || compact);
  const pop: React.CSSProperties = { position: 'absolute', top: wide ? 'calc(100% + 6px)' : 'calc(100% - 2px)', left: wide ? 0 : 14, right: wide ? 0 : 14, background: 'var(--sf)', border: '1px solid var(--ln)', borderRadius: 14, padding: 6, boxShadow: '0 18px 50px rgba(0,0,0,.14)', display: 'flex', flexDirection: 'column', animation: 'siftin .18s ease-out', zIndex: 2 };
  const round: React.CSSProperties = { width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--ln)', background: 'var(--sf)', display: 'grid', placeItems: 'center', flex: 'none' };

  return <header style={{ position: 'sticky', top: 0, zIndex: 30, display: 'flex', flexWrap: twoRow ? 'wrap' : 'nowrap', alignItems: 'center', gap: mobile ? 8 : twoRow ? '12px 14px' : 18, padding: mobile ? '12px 14px' : twoRow ? '14px 24px 10px' : '16px 32px',
    background: 'color-mix(in srgb, var(--bg) 86%, transparent)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}>
    <button onClick={() => st.go('stream')} style={{ flex: 'none', border: 0, background: 'transparent', padding: 0, fontFamily: SERIF, fontSize: 22, fontWeight: 500, letterSpacing: '-.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
      <img src={import.meta.env.BASE_URL + 'icon.svg'} alt="" width={26} height={26} style={{ display: 'block', borderRadius: 6 }} />Sift
    </button>
    <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center' }}>
      <div style={{ position: wide ? 'relative' : 'static', width: '100%', maxWidth: 440 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderRadius: 999, background: 'var(--sf)', border: '1px solid var(--ln)' }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--mu)' }}>/</span>
          <input value={st.query} onChange={e => st.set({ query: e.target.value })} onKeyDown={onKey} placeholder={mobile || compact ? 'Search or /' : 'Search, or / for commands'} aria-label="Search notes"
            style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', outline: 'none', fontSize: 14 }} />
          {st.query && <button onClick={() => st.set({ query: '' })} aria-label="Clear search" style={{ border: 0, background: 'transparent', color: 'var(--mu)', padding: '0 2px', lineHeight: 1 }}>×</button>}
        </div>
        {hits.length > 0 && <div style={pop}>
          {hits.map(h => <button key={h.id} className="h-sf2" onClick={() => st.openNote(h.id)} style={{ display: 'grid', gridTemplateColumns: '10px 1fr auto', gap: 12, alignItems: 'center', padding: '9px 12px', border: 0, borderRadius: 9, background: 'transparent', textAlign: 'left' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: topicColor(h.topic, dark) }} />
            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{ fontFamily: SERIF, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.title || 'Untitled'}</span>
              <span style={{ fontSize: 12, color: 'var(--mu)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.sum}</span>
            </span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--mu)' }}>{fmtShort(h.ts)}</span>
          </button>)}
          <div style={{ padding: '6px 12px 4px', fontSize: 11, color: 'var(--mu)', borderTop: '1px solid var(--ln)' }}>Enter opens the first match{lockedCount && !st.unlocked ? ' · vault notes are not searched' : ''}</div>
        </div>}
        {isCmd && cmds.length > 0 && <div style={pop}>
          {cmds.map(cm => <button key={cm.key} className="h-sf2" onClick={cm.run} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', border: 0, borderRadius: 9, background: 'transparent', textAlign: 'left' }}>
            <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--ac)', minWidth: 84 }}>{cm.key}</span><span>{cm.label}</span>
          </button>)}
        </div>}
      </div>
    </div>
    {!mobile && <nav ref={navRef} className="noscroll" style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 999, background: 'var(--sf)', border: '1px solid var(--ln)', ...(twoRow ? { order: 3, flex: '1 0 100%', overflowX: 'auto' } : { flex: 'none' }) }}>
      {nav.map(n => { const on = st.view === n.id; return <button key={n.id} onClick={() => st.go(n.id)} aria-current={on ? 'page' : undefined} style={{ flex: twoRow ? '1 0 auto' : 'none', justifyContent: 'center', whiteSpace: 'nowrap', padding: '6px 11px', border: 0, borderRadius: 999, background: on ? c.ink : 'transparent', color: on ? c.bg : c.ink, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, transition: 'background .2s' }}>
        <span>{n.label}</span>
        {n.count > 0 && <span style={{ fontFamily: MONO, fontSize: 10, padding: '1px 6px', borderRadius: 999, background: on ? 'rgba(255,255,255,.18)' : c.acs, color: on ? c.bg : c.ac }}>{n.count}</span>}
      </button>; })}
    </nav>}
    <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
      <button className="h-ac" onClick={() => (st.unlocked ? st.lock() : st.askPin())} title={st.unlocked ? 'Lock vault' : 'Unlock vault'}
        style={{ height: 34, padding: '0 11px', borderRadius: 999, border: `1px solid ${st.unlocked ? c.ac : c.ln}`, background: st.unlocked ? c.acs : c.sf, display: 'flex', alignItems: 'center', gap: 7, color: st.unlocked ? c.ac : c.mu, fontFamily: MONO, fontSize: 10, letterSpacing: '.06em' }}>
        <span style={{ position: 'relative', width: 10, height: 12, display: 'inline-block' }}>
          <span style={{ position: 'absolute', left: 1, top: st.unlocked ? -3 : 0, width: 8, height: 7, border: '1.5px solid currentColor', borderBottom: 0, borderRadius: '4px 4px 0 0', transition: 'top .2s' }} />
          <span style={{ position: 'absolute', left: 0, bottom: 0, width: 10, height: 7, borderRadius: 2, background: 'currentColor' }} />
        </span>
        {!mobile && !compact && <span>{st.unlocked ? 'OPEN' : 'VAULT'}</span>}
      </button>
      <button className="h-ac" onClick={() => st.set({ ambient: true })} title="Ambient mode" style={round}>
        <span style={{ width: 14, height: 14, borderRadius: '50%', border: '1.5px solid var(--mu)', display: 'grid', placeItems: 'center' }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--ac)' }} /></span>
      </button>
      <button className="h-ac" onClick={() => void st.setSettings({ theme: dark ? 'light' : 'dark' })} title="Toggle theme" style={round}>
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: dark ? c.ink : c.ac, boxShadow: dark ? 'inset -3px -2px 0 0 ' + c.sf : 'none', display: 'inline-block' }} />
      </button>
    </div>
  </header>;
}

export function MobileNav() {
  const st = useStore(); const { c } = usePalette(); const nav = useNavItems();
  return <nav style={{ position: 'sticky', bottom: 0, zIndex: 30, display: 'grid', gridTemplateColumns: `repeat(${nav.length},1fr)`, gap: 2, margin: '0 10px 12px', padding: 4, borderRadius: 999, background: 'var(--ink)', color: 'var(--bg)', boxShadow: '0 10px 30px rgba(0,0,0,.2)' }}>
    {nav.map(n => { const on = st.view === n.id; return <button key={n.id} onClick={() => st.go(n.id)} style={{ padding: '10px 2px', border: 0, borderRadius: 999, background: on ? c.bg : 'transparent', color: on ? c.ink : c.bg, fontSize: 11, minHeight: 44 }}>{n.mobile ?? n.label}</button>; })}
  </nav>;
}
