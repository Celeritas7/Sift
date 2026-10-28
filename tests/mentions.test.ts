import { mentionIndex, needed } from '../src/lib/mentions';
import { applyWfMutation } from '../src/lib/wf';
import type { WfItemPayload } from '../src/types';
let fails = 0;
const check = (ok: boolean, msg: string, got?: unknown) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok || got === undefined ? '' : '  got ' + JSON.stringify(got))); if (!ok) fails++; };

check(needed(1) === 1 && needed(2) === 2 && needed(3) === 2 && needed(5) === 3, 'words needed: all for 1–2, else 60%');
const find = mentionIndex([
  { id: 'a', text: 'Release notes: publish the banner fix and move the tab bar', ts: 1 },
  { id: 'b', text: 'Banners everywhere. Moved house last week.', ts: 3 },
  { id: 'c', text: 'Grocery list: milk, eggs', ts: 2 },
  { id: 'd', text: 'Need to publish the banner change soon', ts: 4 },
]);
check(JSON.stringify(find('Move banner above tab bar')) === '["a"]', '5-word task needs 3 shared words (b shares only 2)', find('Move banner above tab bar'));
check(find('Publish banners').includes('d'), 'plurals match: "banners" finds "banner"', find('Publish banners'));
check(JSON.stringify(find('Publish banner')) === '["d","a"]', 'equal coverage: newest first', find('Publish banner'));
check(JSON.stringify(find('Publish banner', 'd')) === '["a"]', 'the source note can be left out', find('Publish banner', 'd'));
check(find('Buy milk').length === 0, 'one of two words is not a mention');
check(find('the and of').length === 0, 'stop-words only: no matches');

const p: WfItemPayload = { active: true, pri: 1, objective: 'x', notes: '', ord: 0, targetDone: 0, subtasks: [{ id: 's1', t: 'a', done: false, u: 0 } as never, { id: 's2', t: 'b', done: false, u: 0 } as never] };
const q = applyWfMutation(p, { type: 'delete', id: 's1' });
check(q.subtasks.length === 2 && q.subtasks[0].del === true && q.subtasks[0].u > 0 && !q.subtasks[1].del, 'delete is a tombstone with a fresh u, others untouched');
if (fails) process.exit(1); console.log('\nALL PASSED');
