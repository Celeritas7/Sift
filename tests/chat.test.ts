import { buildChat, dayLabel, REPLY_WINDOW, STRONG_WINDOW } from '../src/lib/chat';
let fails = 0;
const check = (ok: boolean, msg: string, got?: unknown) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok || got === undefined ? '' : '  got ' + JSON.stringify(got))); if (!ok) fails++; };

const now = new Date(2026, 9, 28, 12).getTime(), H = 3600e3;
const n = (id: string, topic: string, ts: number, x: Partial<{ labels: string[]; pinned: boolean; todos: { done: boolean }[] }> = {}) =>
  ({ id, topic, title: id, sum: '', ts, pinned: false, labels: [], todos: [], ...x });
const notes = [
  n('a', 'eng', now - 50 * H, { labels: ['robot'] }),
  n('b', 'soft', now - 26 * H, { labels: ['Robot'] }),
  n('c', 'soft', now - 25.9 * H),
  n('d', 'refl', now - 2 * H, { pinned: true, todos: [{ done: true }, { done: true }] }),
  n('e', 'eng', now - 1 * H, { todos: [{ done: true }, { done: false }] }),
];
const S: Record<string, number> = { 'b|a': .2, 'c|a': .5, 'c|b': .9, 'e|d': .12, 'e|a': .35 };
const sim = (x: string, y: string) => S[x + '|' + y] ?? S[y + '|' + x] ?? 0;
const { msgs, earlier } = buildChat(notes, sim, 60, now);
const by = Object.fromEntries(msgs.map(m => [m.id, m]));
const em = (id: string) => by[id].reactions.map(r => r.emoji + r.n).join(' ');

check(earlier === 0 && msgs.length === 5, 'all five shown, oldest first');
check(by.b.replyTo === 'a', 'replies to the closest earlier note of another topic', by.b.replyTo);
check(by.c.replyTo === 'a', 'same-topic notes are never replied to (c~b is 0.9, same topic)', by.c.replyTo);
check(by.e.replyTo === null, 'below the reply threshold: no reply (e~d 0.12); e~a is outside nothing but same topic', by.e.replyTo);
check(em('a').includes('👍1') && em('b').includes('👍1'), 'shared label across topics, case-insensitive: 👍', [em('a'), em('b')]);
check(em('a').includes('💬2'), 'replied-to note counts its replies', em('a'));
check(em('c') === '🔥2', 'two strong matches (≥0.3): 🔥2', em('c'));
check(em('d') === '✅1 📌1', 'all to-dos done ✅ and pinned 📌', em('d'));
check(!em('e').includes('✅'), 'half-done to-dos: no ✅', em('e'));
check(by.a.day !== null && by.b.day !== null && by.c.day === null && by.d.day === 'Today', 'day separators only where the day changes', msgs.map(m => m.day));
check(by.b.first && !by.c.first, 'same topic within 15 min continues the run', [by.b.first, by.c.first]);
check(dayLabel(now - 24 * H, now) === 'Yesterday' && dayLabel(new Date(2025, 0, 3).getTime(), now) === '3 Jan 2025', 'Yesterday / other-year labels');

const many = Array.from({ length: 100 }, (_, i) => n('m' + i, i % 2 ? 'eng' : 'soft', now - (100 - i) * H));
const r = buildChat(many, (x, y) => (x === 'm99' && y === 'm' + (99 - REPLY_WINDOW - 1) ? 0.9 : 0), 10, now);
check(r.msgs.length === 10 && r.earlier === 90 && r.msgs[0].id === 'm90', 'limit keeps the newest and reports how many are earlier');
check(r.msgs[9].replyTo === null, 'replies only look back REPLY_WINDOW messages');
const far = Array.from({ length: STRONG_WINDOW + 50 }, (_, i) => n('f' + i, 'eng', now - (500 - i) * H));
const fr = buildChat(far, (x, y) => ((x === 'f0' || y === 'f0') ? 0.9 : 0), 1, now);
check(!fr.msgs[0].reactions.length, '🔥 only counts notes within STRONG_WINDOW of each other');
if (fails) process.exit(1); console.log('\nALL PASSED');
