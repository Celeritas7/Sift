import { relockDue, RELOCK_MS } from '../src/lib/vault';
let fails = 0;
const check = (ok: boolean, msg: string) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; };

const t0 = 1_700_000_000_000;
check(RELOCK_MS === 120_000, 'relock limit is two minutes');
check(!relockDue(t0, t0), 'just active: stays unlocked');
check(!relockDue(t0, t0 + RELOCK_MS - 1), 'one ms short of the limit: stays unlocked');
check(relockDue(t0, t0 + RELOCK_MS), 'at the limit: relocks');
check(relockDue(t0, t0 + 60 * 60 * 1000), 'back after an hour in the background: relocks');
check(relockDue(0, t0), 'no recorded activity (e.g. old session from before relock): relocks');
check(relockDue(NaN, t0), 'unreadable timestamp: relocks');
if (fails) process.exit(1); console.log('\nALL PASSED');
