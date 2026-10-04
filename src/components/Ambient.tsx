import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { useAmbientPool, useIsMobile, usePalette } from '../state/derived';
import { MONO, SERIF, topicColor, topicName } from '../lib/config';
import { ago } from '../lib/format';

/** Full-screen slow rotation through the oldest notes not yet opened. Any key or tap exits; Space skips. */
export function Ambient() {
  const st = useStore(); const pool = useAmbientPool(); const { dark } = usePalette(); const mobile = useIsMobile();
  const per = st.settings.ambient_seconds || 20;
  const [idx, setIdx] = useState(0); const [tick, setTick] = useState(0); const [fade, setFade] = useState(false);
  const next = useRef(() => {}); next.current = () => { setFade(true); setTimeout(() => { setIdx(i => i + 1); setFade(false); }, 480); setTick(0); };
  useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (tick >= per) next.current(); }, [tick, per]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { e.preventDefault(); e.stopPropagation(); if (e.key === ' ') next.current(); else st.set({ ambient: false }); };
    window.addEventListener('keydown', k, true); return () => window.removeEventListener('keydown', k, true);
  }, []);
  if (!pool.length) return null; const n = pool[idx % pool.length];
  return <div onClick={() => st.set({ ambient: false })} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--bg)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: mobile ? '40px 24px' : '60px 80px', cursor: 'pointer' }}>
    <div style={{ maxWidth: 900, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 22, opacity: fade ? 0 : 1, transform: fade ? 'translateY(12px)' : 'none', transition: 'opacity .6s,transform .6s' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: MONO, fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--mu)' }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: topicColor(n.topic, dark) }} /><span>{ago(n.ts)}</span><span>·</span><span>{topicName(n.topic)}</span>
      </div>
      <h1 style={{ margin: 0, fontFamily: SERIF, fontSize: mobile ? 40 : 76, fontWeight: 300, lineHeight: 1.05, letterSpacing: '-.035em', textWrap: 'balance' }}>{n.title || 'Untitled'}</h1>
      <p style={{ margin: 0, fontFamily: SERIF, fontSize: mobile ? 20 : 28, fontWeight: 300, lineHeight: 1.45, color: 'var(--mu)', maxWidth: '42ch', textWrap: 'pretty' }}>{n.sum}</p>
    </div>
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 160, height: 2, borderRadius: 1, background: 'var(--sf2)', overflow: 'hidden' }}><div style={{ height: '100%', width: Math.round(tick / per * 100) + '%', background: 'var(--ac)', transition: 'width 1s linear' }} /></div>
      <span style={{ fontSize: 12, color: 'var(--mu)' }}>Tap or press any key to return · Space for next</span>
    </div>
  </div>;
}
