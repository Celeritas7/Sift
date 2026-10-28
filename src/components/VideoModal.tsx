import { useEffect, useMemo, useRef, useState } from 'react';
import { useIndex, useIsMobile, useNotes, usePalette } from '../state/derived';
import { useStore } from '../state/store';
import { buildChat, initials } from '../lib/chat';
import { durationMs, H, LENGTHS, pickMime, W } from '../lib/video';
import { buildScene, drawFrame, loadFonts, recordScene, type Scene } from '../lib/videoRender';
import { MONO, SERIF, TOPICS, topicColor, topicName } from '../lib/config';
import { ghostBtn, inkBtn } from './ui';

type Phase = { k: 'idle' } | { k: 'rec'; p: number } | { k: 'done'; url: string; blob: Blob } | { k: 'error'; msg: string };

/** Records the chat as a short 9:16 video in the browser, then shares or saves it. Vault notes are always left out. */
export function VideoModal({ onClose }: { onClose(): void }) {
  const { c, dark } = usePalette(); const talk = useStore(s => s.talk); const mobile = useIsMobile(); const { open, byId } = useNotes(); const index = useIndex();
  const notes = useMemo(() => [...open].filter(n => !n.vault).reverse(), [open]);
  const vaultLeft = open.length - notes.length;
  const choices = LENGTHS.filter((_, i) => i === 0 || notes.length > LENGTHS[i - 1]);
  const [len, setLen] = useState<number>(notes.length > 10 ? 20 : 10);
  const count = Math.min(len, notes.length);
  const [phase, setPhase] = useState<Phase>({ k: 'idle' }); const [fonts, setFonts] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null); const abort = useRef<AbortController | null>(null); const scene = useRef<Scene | null>(null);
  const fmt = useMemo(() => (typeof MediaRecorder === 'undefined' ? null : pickMime(m => MediaRecorder.isTypeSupported(m))), []);

  useEffect(() => { void loadFonts().then(() => setFonts(true)); }, []);
  // Rebuild the scene when the length changes; show its last frame as the preview.
  useEffect(() => {
    const cv = canvas.current; if (!cv || !fonts) return; const ctx = cv.getContext('2d')!;
    const { msgs } = buildChat(notes.map(n => ({ id: n.id, topic: n.topic, title: n.title || 'Untitled', sum: n.sum, ts: n.ts, pinned: n.pinned, labels: n.labels, todos: n.todoList })), (a, b) => index.sim(a, b), count);
    const members = TOPICS.map(t => t.id as string).filter(t => msgs.some(m => m.topic === t));
    scene.current = buildScene(ctx, { msgs, members, c, color: t => topicColor(t, dark), name: topicName, initials, comments: id => talk.filter(x => x.note_id === id),
      quote: id => { const q = byId[id]; return q && !q.vault ? { topic: q.topic, title: q.title || 'Untitled' } : null; } });
    drawFrame(ctx, scene.current, scene.current.duration);
  }, [fonts, count, notes, index, c, dark, byId, talk]);
  useEffect(() => () => abort.current?.abort(), []); // closing the panel stops a recording
  useEffect(() => () => { if (phase.k === 'done') URL.revokeObjectURL(phase.url); }, [phase]);

  const record = async () => {
    if (!fmt || !canvas.current || !scene.current) return; const ac = new AbortController(); abort.current = ac; setPhase({ k: 'rec', p: 0 });
    try { const blob = await recordScene(canvas.current, scene.current, fmt.mime, p => setPhase({ k: 'rec', p }), ac.signal); setPhase({ k: 'done', url: URL.createObjectURL(blob), blob }); }
    catch (e) { const msg = (e as Error).message; setPhase(msg === 'Cancelled' ? { k: 'idle' } : { k: 'error', msg }); }
    finally { abort.current = null; }
  };
  const file = phase.k === 'done' ? new File([phase.blob], `sift-chat-${new Date().toISOString().slice(0, 10)}.${fmt!.ext}`, { type: phase.blob.type }) : null;
  const canShare = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  const share = async () => { if (file) try { await navigator.share({ files: [file], title: 'Sift chat' }); } catch { /* the user closed the share sheet */ } };
  const close = () => { abort.current?.abort(); onClose(); };
  const secs = Math.round(durationMs(count) / 1000);

  return <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(20,16,12,.5)', display: 'grid', placeItems: 'center', padding: mobile ? 12 : 24, overflow: 'auto' }}>
    <div role="dialog" aria-modal="true" aria-label="Make a video of the chat" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, background: 'var(--sf)', borderRadius: 20, padding: mobile ? 18 : 24, display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 20px 60px rgba(0,0,0,.25)', animation: 'siftin .2s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <h2 style={{ margin: 0, fontFamily: SERIF, fontSize: 24, fontWeight: 400 }}>Make a video</h2>
        <button onClick={close} aria-label="Close" style={{ border: 0, background: 'transparent', fontSize: 20, color: 'var(--mu)', minWidth: 44, minHeight: 44 }}>×</button>
      </div>
      {phase.k === 'done'
        ? <video src={phase.url} controls playsInline style={{ width: '100%', maxHeight: '55vh', aspectRatio: `${W}/${H}`, borderRadius: 12, background: '#000' }} />
        : <canvas ref={canvas} width={W} height={H} aria-label="Video preview" style={{ width: 'auto', height: mobile ? '46vh' : '52vh', maxWidth: '100%', alignSelf: 'center', aspectRatio: `${W}/${H}`, borderRadius: 12, border: '1px solid var(--ln)' }} />}
      {phase.k === 'idle' && <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: 'var(--mu)', marginRight: 2 }}>Latest</span>
          {choices.map(l => { const on = l === len; return <button key={l} aria-pressed={on} onClick={() => setLen(l)} style={{ padding: mobile ? '8px 14px' : '4px 12px', border: `1px solid ${on ? c.ink : c.ln}`, borderRadius: 999, background: on ? c.ink : 'transparent', color: on ? c.bg : c.ink, fontSize: 13 }}>{Math.min(l, notes.length)} notes</button>; })}
          <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--mu)', marginLeft: 'auto' }}>≈ {secs} s</span>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--mu)' }}>Made on this device; nothing is uploaded. Note titles and summaries appear in the video.{vaultLeft ? ` ${vaultLeft} vault note${vaultLeft === 1 ? ' is' : 's are'} left out.` : ' Vault notes are always left out.'}</p>
        {fmt ? <button onClick={() => void record()} disabled={!fonts || !count} style={{ ...inkBtn, alignSelf: 'stretch', minHeight: 44 }}>Record video</button>
          : <p role="alert" style={{ margin: 0, fontSize: 13 }}>This browser can't record video. Try Chrome or Safari.</p>}
      </>}
      {phase.k === 'rec' && <>
        <div role="progressbar" aria-valuenow={Math.round(phase.p * 100)} aria-valuemin={0} aria-valuemax={100} style={{ height: 4, borderRadius: 2, background: 'var(--sf2)', overflow: 'hidden' }}><div style={{ height: '100%', width: phase.p * 100 + '%', background: 'var(--ac)' }} /></div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--mu)' }}>Recording… {Math.round(phase.p * secs)} of {secs} s. Keep Sift open until it finishes.</p>
        <button onClick={() => abort.current?.abort()} style={{ ...ghostBtn, alignSelf: 'flex-start', minHeight: 44 }}>Cancel</button>
      </>}
      {phase.k === 'done' && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {canShare && <button onClick={() => void share()} style={{ ...inkBtn, flex: 1, minHeight: 44 }}>Share</button>}
        <a href={phase.url} download={file!.name} style={{ ...(canShare ? ghostBtn : inkBtn), flex: 1, minHeight: 44, display: 'grid', placeItems: 'center', textDecoration: 'none' }}>Save video</a>
        <button onClick={() => setPhase({ k: 'idle' })} style={{ ...ghostBtn, minHeight: 44 }}>Again</button>
        <p style={{ margin: 0, width: '100%', fontSize: 12, color: 'var(--mu)' }}>{fmt!.ext.toUpperCase()} · {(phase.blob.size / 1e6).toFixed(1)} MB{fmt!.ext === 'webm' ? ' · some apps (e.g. WhatsApp) may not play WebM' : ''}</p>
      </div>}
      {phase.k === 'error' && <>
        <p role="alert" style={{ margin: 0, fontSize: 13 }}>{phase.msg}</p>
        <button onClick={() => setPhase({ k: 'idle' })} style={{ ...inkBtn, alignSelf: 'flex-start', minHeight: 44 }}>Try again</button>
      </>}
    </div>
  </div>;
}
