import { useEffect, useRef, type CSSProperties } from 'react';
import { useStore } from './state/store';
import { useAmbientPool, useIsMobile, usePalette } from './state/derived';
import { focusComposer } from './state/focus';
import { LOCAL_USER, supabase } from './lib/supabase';
import { unsubscribe } from './lib/sync';
import { SANS } from './lib/config';
import { useKeyboardInset } from './lib/keyboard';
import { lastSeen, markSeen, relockDue } from './lib/vault';
import { AI_READY } from './lib/ai';
import { mondayOf } from './lib/format';
import type { Profile } from './types';
import { Header, MobileNav } from './components/Header';
import { Composer } from './components/Composer';
import { NoteSheet } from './components/NoteSheet';
import { PinModal } from './components/PinModal';
import { Ambient } from './components/Ambient';
import { ImportModal } from './components/ImportModal';
import { Login } from './components/Login';
import { Stream } from './screens/Stream';
import { Week } from './screens/Week';
import { MapView } from './screens/Map';
import { Collage } from './screens/Collage';
import { Chat } from './screens/Chat';
import { Lens } from './screens/Lens';
import { Todos } from './screens/Todos';
import { Conflicts } from './screens/Conflicts';
import { Archive } from './screens/Archive';

async function loadProfile(uid: string): Promise<Profile | null> {
  const r = await supabase!.from('authentication_mode_user_roles').select('name,email,role').eq('auth_user_id', uid).maybeSingle();
  return r.error ? null : (r.data as Profile | null);
}

/** Sign-in (cloud) or straight into the local database. */
function useBoot() {
  const init = useStore(s => s.init), setSignedOut = useStore(s => s.setSignedOut);
  useEffect(() => {
    if (!supabase) { void init(LOCAL_USER); return; }
    let current = '';
    const start = async (uid: string | undefined) => {
      if (!uid) { current = ''; unsubscribe(); setSignedOut(); return; }
      if (uid === current) return; current = uid;
      await init(uid, await loadProfile(uid).catch(() => null));
    };
    void supabase.auth.getSession().then(({ data }) => start(data.session?.user.id));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => { setTimeout(() => void start(session?.user.id), 0); });
    return () => data.subscription.unsubscribe();
  }, [init, setSignedOut]);
}

/** After idle_seconds without input, slip into Ambient (never mid-typing, mid-PIN or with a note open). */
function useIdleAmbient() {
  const pool = useAmbientPool(); const last = useRef(Date.now());
  useEffect(() => {
    const act = () => { last.current = Date.now(); }; const evs = ['mousemove', 'pointerdown', 'keydown', 'scroll', 'touchstart'];
    evs.forEach(e => window.addEventListener(e, act, { passive: true, capture: true }));
    const t = setInterval(() => {
      const s = useStore.getState(); const idle = s.settings.idle_seconds ?? 60;
      if (s.phase !== 'ready' || s.ambient || idle <= 0 || s.composerFocused || s.pin.open || s.selId || s.importOpen || s.map.dragging || !pool.length) return;
      if (Date.now() - last.current > idle * 1000) s.set({ ambient: true });
    }, 1000);
    return () => { evs.forEach(e => window.removeEventListener(e, act, { capture: true })); clearInterval(t); };
  }, [pool.length]);
}

/** Relock the vault after two minutes without input; time with the app in the background counts too. */
function useVaultRelock() {
  const unlocked = useStore(s => s.unlocked);
  useEffect(() => {
    if (!unlocked) return;
    let wrote = 0;
    const act = () => { const now = Date.now(); if (now - wrote > 5000) { wrote = now; markSeen(now); } };
    const check = () => { const s = useStore.getState(); if (s.unlocked && relockDue(lastSeen(), Date.now())) s.lock(); };
    const vis = () => { if (document.visibilityState === 'visible') check(); };
    act(); const evs = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'wheel'];
    evs.forEach(e => window.addEventListener(e, act, { passive: true, capture: true }));
    document.addEventListener('visibilitychange', vis); const t = setInterval(check, 5000);
    return () => { evs.forEach(e => window.removeEventListener(e, act, { capture: true })); document.removeEventListener('visibilitychange', vis); clearInterval(t); };
  }, [unlocked]);
}

/** "Write one automatically every Monday": once the week is over, write last week's digest if it has none (once per week per device).
 *  Waits a few seconds after the notes change, so the first sync has landed before it looks. */
function useAutoDigest() {
  const phase = useStore(s => s.phase), on = useStore(s => s.settings.monday_digest), count = useStore(s => Object.keys(s.notes).length);
  useEffect(() => {
    if (!AI_READY || phase !== 'ready' || !on) return;
    const t = setTimeout(() => {
      const s = useStore.getState(), week = mondayOf(Date.now() - 7 * 864e5), key = `sift-auto-digest-${s.userId}-${week}`;
      if (s.digests[week]?.text) return;
      const ids = Object.values(s.notes).filter(n => !n.deleted_at && !n.archived && !n.vault && mondayOf(Date.parse(n.created_at)) === week)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)).map(n => n.id).slice(-120);
      if (!ids.length) return;
      try { if (localStorage.getItem(key)) return; localStorage.setItem(key, '1'); } catch { return; }
      void s.writeDigest(week, ids);
    }, 4000);
    return () => clearTimeout(t);
  }, [phase, on, count]);
}

function useGlobalKeys() {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const s = useStore.getState(); const tag = (e.target as HTMLElement | null)?.tagName || '';
      if (s.ambient || s.pin.open) return; // those overlays own the keyboard
      if (e.key === 'Escape') { if (s.importOpen) s.set({ importOpen: false }); else s.set({ selId: null, query: '', sendFor: null }); return; }
      if ((e.key === 'n' || e.key === 'N') && !e.metaKey && !e.ctrlKey && !e.altKey && !/INPUT|TEXTAREA|SELECT/.test(tag) && !s.selId && !s.importOpen) { e.preventDefault(); focusComposer(); }
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);
}

export function App() {
  useBoot(); useGlobalKeys(); useIdleAmbient(); useVaultRelock(); useAutoDigest(); useKeyboardInset();
  const st = useStore(); const { c } = usePalette(); const mobile = useIsMobile();
  const vars = { '--bg': c.bg, '--sf': c.sf, '--sf2': c.sf2, '--ink': c.ink, '--mu': c.mu, '--ln': c.ln, '--ac': c.ac, '--acs': c.acs, '--acink': c.acink } as CSSProperties;
  useEffect(() => {
    document.body.style.background = c.bg; document.querySelector('meta[name="theme-color"]')?.setAttribute('content', c.bg);
    Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, String(v)));
  }, [c]);

  const shell: CSSProperties = { ...vars, minHeight: '100dvh', background: 'var(--bg)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, lineHeight: 1.5, transition: 'background .3s,color .3s' };
  if (st.phase === 'boot') return <div style={shell} />;
  if (st.phase === 'signedOut') return <div style={shell}><Login /></div>;

  const Screen = { stream: Stream, week: Week, map: MapView, collage: Collage, chat: Chat, lens: Lens, todos: Todos, conflicts: Conflicts, archive: Archive }[st.view];
  return <div data-screen-label="Sift" style={shell}>
    <div style={{ maxWidth: mobile ? 430 : 1240, margin: '0 auto', minHeight: '100dvh', overflowX: 'clip', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <Header />
      {st.error && <div role="alert" style={{ margin: mobile ? '0 16px' : '0 36px', padding: '10px 14px', borderRadius: 12, background: 'var(--acs)', color: 'var(--ink)', fontSize: 13, display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ flex: 1 }}>{st.error}</span><button onClick={() => st.set({ error: null })} aria-label="Dismiss" style={{ border: 0, background: 'transparent', color: 'var(--mu)' }}>×</button></div>}
      {st.aiBulk && <div role="status" style={{ margin: mobile ? '0 16px' : '0 36px', padding: '10px 14px', borderRadius: 12, background: 'var(--sf)', border: '1px solid var(--ln)', fontSize: 13, display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ flex: 1 }}>{st.aiBulk.stop ? 'Stopping after this batch…' : `Summarising notes with Claude… ${st.aiBulk.done} of ${st.aiBulk.total}`}</span>
        {!st.aiBulk.stop && <button onClick={() => st.set({ aiBulk: { ...st.aiBulk!, stop: true } })} style={{ border: '1px solid var(--ln)', borderRadius: 999, background: 'transparent', padding: '4px 12px', fontSize: 12, minHeight: mobile ? 36 : undefined }}>Stop</button>}</div>}
      <main style={{ padding: mobile ? '10px 16px 150px' : '22px 36px 170px', display: 'flex', flexDirection: 'column', gap: mobile ? 28 : 44, flex: 1 }}>
        <Screen />
      </main>
      {mobile && <MobileNav />}
      <Composer />
      <NoteSheet />
      {st.pin.open && <PinModal />}
      {st.ambient && <Ambient />}
      {st.importOpen && <ImportModal />}
    </div>
  </div>;
}
