import { commitAt, isHorizontal, swipeAction } from '../src/lib/swipe';
let fails = 0;
const check = (ok: boolean, msg: string, got?: unknown) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok || got === undefined ? '' : '  got ' + JSON.stringify(got))); if (!ok) fails++; };

check(commitAt(400) === 100, 'commit at a quarter of the row', commitAt(400));
check(commitAt(200) === 80, 'never less than 80px on a narrow row', commitAt(200));
check(swipeAction(100, 400) === 'pin', 'right past the line pins');
check(swipeAction(-100, 400) === 'archive', 'left past the line archives');
check(swipeAction(99, 400) === null && swipeAction(-99, 400) === null, 'short of the line does nothing');
check(swipeAction(0, 400) === null, 'no movement does nothing');
check(!isHorizontal(8, 0), 'inside the slop is undecided');
check(isHorizontal(30, 10), 'mostly sideways is a swipe');
check(!isHorizontal(30, 25), 'diagonal goes to scrolling');
check(!isHorizontal(5, 40), 'vertical is a scroll');
if (fails) process.exit(1); console.log('\nALL PASSED');
