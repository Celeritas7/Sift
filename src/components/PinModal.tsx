import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { usePalette } from '../state/derived';
import { MONO, SERIF } from '../lib/config';

export function PinModal() {
  const st = useStore(); const { c } = usePalette();
  const [pin, setPin] = useState(''); const [err, setErr] = useState<string | null>(null); const [first, setFirst] = useState<string | null>(null);
  const busy = useRef(false); const setting = st.pin.mode === 'set';
  const pinRef = useRef(''); const firstRef = useRef<string | null>(null);
  const put = (v: string) => { pinRef.current = v; setPin(v); };
  const putFirst = (v: string | null) => { firstRef.current = v; setFirst(v); };
  const fail = (msg: string) => { setErr(msg); setTimeout(() => { put(''); setErr(null); }, 450); };
  const press = (d: string) => {
    if (busy.current || pinRef.current.length >= 4) return;
    const next = pinRef.current + d; put(next); if (next.length < 4) return;
    busy.current = true;
    setTimeout(async () => {
      try {
        if (setting) {
          if (!firstRef.current) { putFirst(next); put(''); }
          else if (firstRef.current !== next) { putFirst(null); fail('PINs did not match'); }
          else { await st.setPin(next); putFirst(null); put(''); }
        } else {
          const r = await st.checkPin(next);
          if (r === 'ok') put(''); else fail(r === 'offline' ? 'Needs a connection' : 'Wrong PIN');
        }
      } finally { busy.current = false; }
    }, 120);
  };
  const back = () => put(pinRef.current.slice(0, -1));
  const close = () => { put(''); putFirst(null); setErr(null); st.set({ pin: { open: false, mode: 'enter', after: null } }); };
  const keys = useRef({ press, back, close }); keys.current = { press, back, close };

  useEffect(() => {
    const k = (e: KeyboardEvent) => { e.stopPropagation();
      const h = keys.current; if (/^\d$/.test(e.key)) h.press(e.key); else if (e.key === 'Backspace') h.back(); else if (e.key === 'Escape') h.close(); };
    window.addEventListener('keydown', k, true); return () => window.removeEventListener('keydown', k, true);
  }, []);

  const prompt = err ?? (setting ? (first ? 'Repeat the PIN' : st.hasPin ? 'New PIN' : 'Choose a 4-digit PIN') : 'Enter PIN');
  const hint = setting ? 'Only a hash is stored · or type on keyboard' : st.pinIsDemo ? 'Demo PIN 0000 · or type on keyboard' : 'Or type on keyboard';
  return <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(20,16,12,.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'grid', placeItems: 'center', padding: 20 }}>
    <section role="dialog" aria-modal="true" aria-label="Vault PIN" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 320, background: 'var(--sf)', borderRadius: 24, padding: '28px 24px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, boxShadow: '0 30px 80px rgba(0,0,0,.35)', animation: 'siftin .2s ease-out' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--mu)' }}>Vault</span>
        <h2 style={{ margin: 0, fontFamily: SERIF, fontSize: 24, fontWeight: 400, letterSpacing: '-.02em' }}>{prompt}</h2>
      </div>
      <div style={{ display: 'flex', gap: 14, animation: err ? 'siftshake .3s' : 'none' }}>
        {[0, 1, 2, 3].map(i => <span key={i} style={{ width: 13, height: 13, borderRadius: '50%', border: `1.5px solid ${err ? c.ink : i < pin.length ? c.ac : c.mu}`, background: i < pin.length ? (err ? c.ink : c.ac) : 'transparent', transition: 'background .12s' }} />)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,64px)', gap: 10 }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) => <button key={i} className="a-key" aria-label={k === '⌫' ? 'Delete' : k} onClick={() => (k === '⌫' ? back() : k && press(k))}
          style={{ height: 64, borderRadius: '50%', border: `1px solid ${k === '⌫' ? 'transparent' : c.ln}`, background: k === '⌫' ? 'transparent' : c.bg, fontFamily: SERIF, fontSize: 24, fontWeight: 300, visibility: k ? 'visible' : 'hidden' }}>{k}</button>)}
      </div>
      <span style={{ fontSize: 12, color: 'var(--mu)' }}>{hint}</span>
    </section>
  </div>;
}
