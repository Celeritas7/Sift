import { durationMs, msgStart, pickMime, prog, scrollAt, wrap, T_INTRO, T_MSG, T_OUTRO } from '../src/lib/video';
let fails = 0;
const check = (ok: boolean, msg: string, got?: unknown) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok || got === undefined ? '' : '  got ' + JSON.stringify(got))); if (!ok) fails++; };
const m = (s: string) => Array.from(s).length * 10; // every character 10px

check(durationMs(20) === T_INTRO + 20 * T_MSG + T_OUTRO && durationMs(20) === 33200, '20 messages ≈ 33 s', durationMs(20));
check(msgStart(0) === T_INTRO && msgStart(3) === T_INTRO + 3 * T_MSG, 'messages start one after another');
check(prog(0, 100, 100) === 0 && prog(150, 100, 100) > 0.5 && prog(500, 100, 100) === 1, 'eased progress clamps to 0..1');

check(JSON.stringify(wrap('the quick brown fox', 100, m)) === '["the quick","brown fox"]', 'wraps on spaces', wrap('the quick brown fox', 100, m));
check(JSON.stringify(wrap('楽天損保のリビングアシスタンス', 60, m)) === '["楽天損保のリ","ビングアシス","タンス"]', 'no-space text breaks between characters', wrap('楽天損保のリビングアシスタンス', 60, m));
check(JSON.stringify(wrap('see https://example.com/a/very/long/path ok', 100, m)) === '["see","https://ex","ample.com/","a/very/lon","g/path ok"]', 'long URL breaks inside', wrap('see https://example.com/a/very/long/path ok', 100, m));
const cut = wrap('one two three four five six seven', 100, m, 2);
check(cut.length === 2 && cut[1].endsWith('…') && m(cut[1]) <= 100, 'maxLines ends the last line with … and keeps it in width', cut);
check(wrap('   ', 100, m).length === 0, 'blank text: no lines');

check(pickMime(x => x === 'video/mp4' || x.startsWith('video/webm'))?.ext === 'mp4', 'prefers MP4 when supported');
check(pickMime(x => x === 'video/webm;codecs=vp8')?.mime === 'video/webm;codecs=vp8', 'falls back to WebM');
check(pickMime(() => false) === null, 'no recorder support: null');

const bottoms = [400, 800, 1300, 1700];
check(scrollAt(0, bottoms, 1000) === 0, 'nothing shown yet: no scroll');
check(scrollAt(msgStart(1) + 1000, bottoms, 1000) === 0, 'still fits: no scroll');
check(scrollAt(msgStart(2) + 1000, bottoms, 1000) === 300, 'third message pushes the stack up by its overflow', scrollAt(msgStart(2) + 1000, bottoms, 1000));
const mid = scrollAt(msgStart(3) + 100, bottoms, 1000); check(mid > 300 && mid < 700, 'scroll eases between messages', mid);
if (fails) process.exit(1); console.log('\nALL PASSED');
