import { batches, checkSummaries, digestInput, isIdList, isWeekOf, MAX_DIGEST_IDS, summaryInput, type NoteRow } from '../supabase/functions/sift-ai/lib';
let fails = 0;
const check = (ok: boolean, msg: string, got?: unknown) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok || got === undefined ? '' : '  got ' + JSON.stringify(got))); if (!ok) fails++; };
const id = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
const note = (i: number, body = 'x'): NoteRow => ({ id: id(i), title: 'T' + i, body, topic: 'scrap', lang: 'EN', created_at: '2026-10-20T09:00:00Z' });

const b = batches([note(1, 'a'.repeat(100)), note(2, 'b'.repeat(100)), note(3, 'c'.repeat(100))], 400);
check(b.length === 2 && b[0].length === 2 && b[1].length === 1, 'batches split by size', b.map(x => x.length));
const big = batches([note(1, 'a'.repeat(1000)), note(2)], 400);
check(big.length === 2 && big[0][0].body.length === 1000, 'an oversized note goes alone and whole (never cut)');
check(batches([]).length === 0, 'no notes: no batches');

const asked = new Set([id(1), id(2)]);
const got = checkSummaries({ summaries: [
  { id: id(1), summary: '  Trip plan for Kyoto.  ', summary_orig: '京都旅行の計画。' },
  { id: id(1), summary: 'duplicate', summary_orig: null },
  { id: id(9), summary: 'not asked', summary_orig: null },
  { id: id(2), summary: '', summary_orig: null },
  { id: id(2), summary: 'Groceries.', summary_orig: '   ' },
] }, asked);
check(got.length === 2 && got[0].summary === 'Trip plan for Kyoto.' && got[0].summary_orig === '京都旅行の計画。', 'trims, keeps the original-language line', got);
check(got[1].id === id(2) && got[1].summary_orig === null, 'skips empty, duplicate and unasked ids; blank summary_orig becomes null', got[1]);
check(checkSummaries('nope', asked).length === 0 && checkSummaries({ summaries: 'x' }, asked).length === 0, 'malformed output: nothing');

check(isIdList([id(1)]) && !isIdList([]) && !isIdList(['1; drop table']) && !isIdList(Array.from({ length: 26 }, (_, i) => id(i))), 'ids: uuids only, 1–25');
check(isIdList(Array.from({ length: MAX_DIGEST_IDS }, (_, i) => id(i)), MAX_DIGEST_IDS), 'digest allows up to 120 ids');
check(isWeekOf('2026-10-19') && !isWeekOf('19/10/2026'), 'week_of is YYYY-MM-DD');
const si = summaryInput([note(1, 'milk, eggs')]);
check(si.includes(`<note id="${id(1)}">`) && si.includes('milk, eggs'), 'summary input carries id and full body');
const di = digestInput('2026-10-19', [note(1), note(2)]);
check(di.startsWith('The week starting 2026-10-19. 2 notes') && di.includes('date="2026-10-20"') && di.includes('topic="scrap"'), 'digest input has week, count, dates, topics');
if (fails) process.exit(1); console.log('\nALL PASSED');
