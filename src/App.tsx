import { useEffect, useRef, type CSSProperties } from 'react';
import { useStore } from './state/store';
import { useAmbientPool, useIsMobile, usePalette } from './state/derived';
import { focusComposer } from './state/focus';
import { LOCAL_USER, supabase } from './lib/supabase';
import { unsubscribe } from './lib/sync';
import { SANS } from './lib/config';
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
  useBoot(); useGlobalKeys(); useIdleAmbient();
  const st = useStore(); const { c } = usePalette(); const mobile = useIsMobile();
  const vars = { '--bg': c.bg, '--sf': c.sf, '--sf2': c.sf2, '--ink': c.ink, '--mu': c.mu, '--ln': c.ln, '--ac': c.ac, '--acs': c.acs, '--acink': c.acink } as CSSProperties;
  useEffect(() => {
    document.body.style.background = c.bg; document.querySelector('meta[name="theme-color"]')?.setAttribute('content', c.bg);
    Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, String(v)));
  }, [c]);

  const shell: CSSProperties = { ...vars, minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, lineHeight: 1.5, transition: 'background .3s,color .3s' };
  if (st.phase === 'boot') return <div style={shell} />;
  if (st.phase === 'signedOut') return <div style={shell}><Login /></div>;

  const Screen = { stream: Stream, week: Week, map: MapView, collage: Collage, lens: Lens, todos: Todos, conflicts: Conflicts, archive: Archive }[st.view];
  return <div data-screen-label="Sift" style={shell}>
    <div style={{ maxWidth: mobile ? 430 : 1240, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <Header />
      {st.error && <div role="alert" style={{ margin: mobile ? '0 16px' : '0 36px', padding: '10px 14px', borderRadius: 12, background: 'var(--acs)', color: 'var(--ink)', fontSize: 13, display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ flex: 1 }}>{st.error}</span><button onClick={() => st.set({ error: null })} aria-label="Dismiss" style={{ border: 0, background: 'transparent', color: 'var(--mu)' }}>×</button></div>}
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
