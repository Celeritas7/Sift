import type { CSSProperties, ReactNode } from 'react';
import { MONO, SERIF } from '../lib/config';
import { useIsMobile, usePalette } from '../state/derived';

export const mono = (size = 11, extra: CSSProperties = {}): CSSProperties => ({ fontFamily: MONO, fontSize: size, ...extra });
export const eyebrowStyle: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--mu)' };
export const serif = (size: number, weight = 400, extra: CSSProperties = {}): CSSProperties => ({ fontFamily: SERIF, fontSize: size, fontWeight: weight, ...extra });

export function Eyebrow({ children, rule = true, style }: { children: ReactNode; rule?: boolean; style?: CSSProperties }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', ...eyebrowStyle, ...style }}>
    {rule && <span style={{ width: 18, height: 1, background: 'var(--ac)' }} />}{children}
  </div>;
}

export function H1({ children }: { children: ReactNode }) {
  const m = useIsMobile();
  return <h1 style={{ margin: 0, fontFamily: SERIF, fontSize: m ? 34 : 48, fontWeight: 300, letterSpacing: '-.03em', lineHeight: 1 }}>{children}</h1>;
}

export function Lede({ children, max = 56 }: { children: ReactNode; max?: number }) {
  return <p style={{ margin: 0, color: 'var(--mu)', maxWidth: max + 'ch' }}>{children}</p>;
}

export function Chip({ t, strong }: { t: string; strong?: boolean }) {
  return <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.04em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 4,
    background: strong ? 'var(--ac)' : 'var(--acs)', color: strong ? 'var(--acink)' : 'var(--ac)' }}>{t}</span>;
}

/** Round check used by to-dos and Weekly Focus rows. */
export function Check({ done, size = 20, font = 11 }: { done: boolean; size?: number; font?: number }) {
  const { c } = usePalette();
  return <span style={{ width: size, height: size, flex: 'none', marginTop: 2, borderRadius: '50%', border: `1.5px solid ${done ? c.ac : c.mu}`, background: done ? c.ac : 'transparent',
    display: 'grid', placeItems: 'center', color: 'var(--bg)', fontSize: font, transition: 'all .15s' }}>{done ? '✓' : ''}</span>;
}

export function Spinner() {
  return <span style={{ width: 11, height: 11, border: '2px solid rgba(255,255,255,.3)', borderTopColor: 'var(--bg)', borderRadius: '50%', animation: 'siftspin .8s linear infinite', display: 'inline-block' }} />;
}

export const inkBtn: CSSProperties = { padding: '8px 14px', border: 0, borderRadius: 999, background: 'var(--ink)', color: 'var(--bg)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 };
export const ghostBtn: CSSProperties = { border: '1px solid var(--ln)', background: 'transparent', padding: '4px 10px', borderRadius: 999, fontSize: 12 };
