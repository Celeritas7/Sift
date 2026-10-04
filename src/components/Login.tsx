import { useState } from 'react';
import { signInWithGoogle } from '../lib/supabase';
import { MONO, SERIF } from '../lib/config';

export function Login() {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const go = async () => { setBusy(true); setErr(null); const r = await signInWithGoogle(); if (r?.error) { setErr(r.error.message); setBusy(false); } };
  return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 420, animation: 'siftin .22s ease-out' }}>
      <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 500, letterSpacing: '-.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--ac)', display: 'inline-block' }} />Sift
      </div>
      <h1 style={{ margin: 0, fontFamily: SERIF, fontSize: 48, fontWeight: 300, letterSpacing: '-.03em', lineHeight: 1.05 }}>Your notes, sifted.</h1>
      <p style={{ margin: 0, color: 'var(--mu)' }}>Bring in Google Keep, see what's near what, and keep your Weekly Focus in step.</p>
      <button onClick={go} disabled={busy} style={{ alignSelf: 'flex-start', padding: '10px 18px', border: 0, borderRadius: 999, background: 'var(--ink)', color: 'var(--bg)', fontSize: 14, opacity: busy ? .6 : 1 }}>
        {busy ? 'Opening Google…' : 'Continue with Google'}</button>
      {err && <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--ac)' }}>{err}</span>}
    </div>
  </div>;
}
