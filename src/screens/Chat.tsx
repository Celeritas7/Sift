import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { useIndex, useIsMobile, useNotes, usePalette } from '../state/derived';
import { buildChat, initials, type ChatMsg } from '../lib/chat';
import { MONO, SERIF, TOPICS, topicColor, topicName } from '../lib/config';
import { plural } from '../lib/format';
import { Eyebrow, H1, Lede, ghostBtn, inkBtn } from '../components/ui';
import { AI_READY, TALK_NOTES } from '../lib/ai';
import { NO_AI } from '../lib/config';
import { VideoModal } from '../components/VideoModal';

const PAGE = 60;
const time = (ts: number) => new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

function Avatar({ topic, size = 32 }: { topic: string; size?: number }) {
  const { dark } = usePalette();
  return <span aria-hidden="true" style={{ width: size, height: size, flex: 'none', borderRadius: '50%', background: topicColor(topic, dark), color: '#fff', display: 'grid', placeItems: 'center', fontFamily: MONO, fontSize: size * .34, fontWeight: 500, letterSpacing: '.02em' }}>{initials(topic)}</span>;
}

/** Your notes as a group chat between topics: replies from text similarity, reactions from labels, to-dos and pins. */
export function Chat() {
  const st = useStore(); const { dark } = usePalette(); const mobile = useIsMobile(); const { open, byId } = useNotes(); const index = useIndex();
  const [limit, setLimit] = useState(PAGE); const [flash, setFlash] = useState<string | null>(null); const [video, setVideo] = useState(false);
  const { msgs, earlier } = useMemo(() => buildChat([...open].reverse().map(n => ({ id: n.id, topic: n.topic, title: n.title || 'Untitled', sum: n.sum, ts: n.ts, pinned: n.pinned, labels: n.labels, todos: n.todoList })),
    (a, b) => index.sim(a, b), limit), [open, index, limit]);
  const members = TOPICS.filter(t => msgs.some(m => m.topic === t.id));
  // AI comments, only on notes shown here and never on vault notes (even while unlocked).
  const talkOn = useMemo(() => { const out: Record<string, typeof st.talk> = {}; st.talk.forEach(c => { const n = byId[c.note_id]; if (n && !n.vault) (out[c.note_id] ||= []).push(c); }); return out; }, [st.talk, byId]);
  const talkIds = msgs.filter(m => !byId[m.id]?.vault).slice(-TALK_NOTES).map(m => m.id);
  const talking = !!st.aiBusy.talk;

  // Open at the newest message (and follow new ones), like a chat; "Show earlier" keeps the reader's place instead.
  const keep = useRef<number | null>(null);
  useLayoutEffect(() => { const h = document.documentElement.scrollHeight; if (keep.current != null) { scrollTo(0, h - keep.current); keep.current = null; } else scrollTo(0, h); }, [limit, msgs[msgs.length - 1]?.id]);
  const showEarlier = () => { keep.current = document.documentElement.scrollHeight - scrollY; setLimit(l => l + PAGE); };
  const jump = (id: string) => { const el = document.getElementById('chat-' + id); if (!el) { st.openNote(id); return; } el.scrollIntoView({ behavior: 'smooth', block: 'center' }); setFlash(id); setTimeout(() => setFlash(f => (f === id ? null : f)), 1400); };

  if (!msgs.length) return <p style={{ margin: 0, fontFamily: SERIF, fontSize: 24, fontWeight: 300, fontStyle: 'italic', color: 'var(--mu)' }}>No notes to chat about yet. Write one below.</p>;

  const bubble = (m: ChatMsg) => {
    const q = m.replyTo ? byId[m.replyTo] : null; const color = topicColor(m.topic, dark);
    return <div key={m.id} id={'chat-' + m.id} style={{ display: 'grid', gridTemplateColumns: '32px minmax(0,1fr)', gap: 10, marginTop: m.first ? 14 : 4 }}>
      {m.first ? <Avatar topic={m.topic} /> : <span />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, alignItems: 'flex-start' }}>
        {m.first && <span style={{ fontSize: 12, fontWeight: 600, color }}>{topicName(m.topic)}</span>}
        <button onClick={() => st.openNote(m.id)} className="h-ac" style={{ maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: 4, padding: '9px 13px 7px', border: '1px solid var(--ln)', borderRadius: m.first ? '4px 16px 16px 16px' : 16, background: flash === m.id ? 'var(--acs)' : 'var(--sf)', textAlign: 'left', transition: 'background .3s' }}>
          {q && <span role="link" tabIndex={0} onClick={e => { e.stopPropagation(); jump(q.id); }} onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); jump(q.id); } }}
            style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: '5px 9px', borderLeft: `3px solid ${topicColor(q.topic, dark)}`, borderRadius: 6, background: 'var(--sf2)', cursor: 'pointer', minWidth: 0, maxWidth: '100%' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: topicColor(q.topic, dark) }}>↩ {topicName(q.topic)}</span>
            <span style={{ fontSize: 13, color: 'var(--mu)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.title || 'Untitled'}</span>
          </span>}
          <span style={{ fontFamily: SERIF, fontSize: 16, lineHeight: 1.3 }}>{m.title}</span>
          {m.sum && m.sum !== m.title && <span style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--mu)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{m.sum}</span>}
          <span style={{ alignSelf: 'flex-end', fontFamily: MONO, fontSize: 10, color: 'var(--mu)' }}>{time(m.ts)}</span>
        </button>
        {m.reactions.length > 0 && <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: -2 }}>
          {m.reactions.map(r => <span key={r.emoji} title={r.why} aria-label={r.why} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '1px 7px', border: '1px solid var(--ln)', borderRadius: 999, background: 'var(--bg)', fontSize: 12 }}>
            <span>{r.emoji}</span>{r.n > 1 && <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--mu)' }}>{r.n}</span>}</span>)}
        </div>}
        {(talkOn[m.id] ?? []).map(cm => <div key={cm.topic} data-ai-comment style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 4, maxWidth: '100%' }}>
          <Avatar topic={cm.topic} size={22} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '6px 11px', border: '1px dashed var(--ln)', borderRadius: '4px 14px 14px 14px', background: 'var(--bg)', minWidth: 0 }}>
            <span style={{ display: 'flex', gap: 6, alignItems: 'baseline', fontSize: 11, fontWeight: 600, color: topicColor(cm.topic, dark) }}>{topicName(cm.topic)}
              <span title="Written by Claude" style={{ fontFamily: MONO, fontSize: 9, fontWeight: 400, letterSpacing: '.06em', padding: '0 5px', borderRadius: 4, background: 'var(--sf2)', color: 'var(--mu)' }}>AI</span></span>
            <span style={{ fontSize: 14, lineHeight: 1.4 }}>{cm.text}</span>
          </div>
        </div>)}
      </div>
    </div>;
  };

  return <>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Eyebrow><span>Chat · {plural(members.length, 'topic')}</span></Eyebrow>
      <H1>Your topics, talking</H1>
      <Lede max={60}>Each note is a message from its topic. A note replies to an earlier one from another topic when their words are close. 👍 another topic uses the same label · 🔥 closely related notes · 💬 replies · ✅ to-dos done · 📌 pinned.</Lede>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex' }}>{members.map((t, i) => <span key={t.id} title={t.name} style={{ marginLeft: i ? -8 : 0, borderRadius: '50%', border: '2px solid var(--bg)', display: 'flex' }}><Avatar topic={t.id} size={28} /></span>)}</div>
        <span style={{ fontSize: 13, color: 'var(--mu)' }}>{members.map(t => t.name).join(', ')}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => setVideo(true)} style={{ ...inkBtn, minHeight: mobile ? 44 : undefined, display: 'flex', alignItems: 'center', gap: 8 }}><span aria-hidden="true">▶</span>Make video</button>
        <button onClick={() => void st.letThemTalk(talkIds)} disabled={!AI_READY || talking || talkIds.length < 2} title={AI_READY ? 'Claude writes a few comments between your topics' : NO_AI}
          style={{ ...inkBtn, background: 'var(--ac)', color: 'var(--acink)', minHeight: mobile ? 44 : undefined, opacity: AI_READY && talkIds.length >= 2 ? 1 : .45 }}>{talking ? 'Listening in…' : st.talk.length ? '✨ Talk again' : '✨ Let them talk'}</button>
        {st.talk.length > 0 && !talking && <button onClick={() => void st.clearTalk()} style={{ ...ghostBtn, minHeight: mobile ? 44 : undefined }}>Clear AI comments</button>}
      </div>
      <span style={{ fontSize: 12, color: 'var(--mu)' }}>{AI_READY ? `"Let them talk" sends your latest ${TALK_NOTES} non-vault notes to Claude for a few comments, marked AI and synced to your other devices.` : NO_AI + '.'}</span>
    </div>
    <section aria-label="Chat" style={{ display: 'flex', flexDirection: 'column', maxWidth: 720, width: '100%', margin: mobile ? 0 : '0 auto' }}>
      {earlier > 0 && <button onClick={showEarlier} className="h-ac" style={{ alignSelf: 'center', padding: '6px 14px', minHeight: mobile ? 44 : undefined, border: '1px solid var(--ln)', borderRadius: 999, background: 'transparent', fontSize: 12 }}>Show earlier · {earlier} more</button>}
      {msgs.map(m => <div key={m.id}>
        {m.day && <div style={{ display: 'flex', justifyContent: 'center', margin: '18px 0 2px' }}><span style={{ padding: '3px 10px', borderRadius: 999, background: 'var(--sf2)', fontFamily: MONO, fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--mu)' }}>{m.day}</span></div>}
        {bubble(m)}
      </div>)}
    </section>
    {video && <VideoModal onClose={() => setVideo(false)} />}
  </>;
}
