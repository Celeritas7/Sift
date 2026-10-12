import { pickExcerpt } from '../src/lib/parse';
import { tokens } from '../src/lib/collage';
let fails = 0;
const check = (ok: boolean, msg: string, got?: unknown) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok || got === undefined ? '' : '  got ' + JSON.stringify(got))); if (!ok) fails++; };
const slices = (x: { text: string; hits: [number, number][] }) => x.hits.map(([a, b]) => x.text.slice(a, b));

// 1. Query: first sentence holding every word (case-insensitive), hits = word ranges.
{
  const body = 'We met on Monday. The Gripper spec changed for the ECN list today. Gripper again later.';
  const x = pickExcerpt(body, '', 'gripper ecn');
  check(x?.text === '…The Gripper spec changed for the ECN list today.', 'query picks the first sentence with all words', x?.text);
  check(JSON.stringify(slices(x!)) === '["Gripper","ECN"]', 'hit ranges cover each query word', slices(x!));
  check(JSON.stringify(x!.hits) === '[[5,12],[34,37]]', 'hit offsets account for the leading "…"', x!.hits);
  const y = pickExcerpt('Gripper first. Then more gripper.', '', 'GRIPPER');
  check(y?.text === 'Gripper first.' && JSON.stringify(y.hits) === '[[0,7]]', 'case-insensitive, first sentence has no leading "…"', y);
  check(pickExcerpt('Nothing relevant in this body at all.', '', 'groceries') === null, 'title-only match (no sentence hit) → null');
}
// 2. Sentences already in the summary are skipped.
{
  const body = 'Ship the new onboarding flow before the quarterly review. Remember that tamarind chutney recipe from grandmother last summer.';
  const sum = 'Ship the new onboarding flow before the quarterly review.';
  const x = pickExcerpt(body, sum, '');
  check(x?.text === '…Remember that tamarind chutney recipe from grandmother last summer.', 'sentence contained in sum is skipped', x?.text);
}
// 3. Rare-word pick: 1/df weighting, ties to the earlier sentence.
{
  const body = 'Meeting notes about the project status update today. Kintsugi repairs broken pottery with powdered gold lacquer seams.';
  const df = new Map<string, number>();
  tokens('Meeting notes about the project status update today').forEach(t => df.set(t, 40));
  tokens('Kintsugi repairs broken pottery with powdered gold lacquer seams').forEach(t => df.set(t, 1));
  const x = pickExcerpt(body, '', '', df);
  check(x?.text.startsWith('…Kintsugi'), 'sentence with rare words wins over common ones', x?.text);
  const tie = pickExcerpt('Alpha bravo charlie delta echo foxtrot. Golf hotel india juliet kilo lima.', '', '');
  check(tie?.text === 'Alpha bravo charlie delta echo foxtrot.', 'tie goes to the earlier sentence', tie?.text);
  check(pickExcerpt('Too short here. Also short.', '', '') === null, 'sentences under 6 words are skipped → null');
}
// 4. Checklist and URL lines are skipped.
{
  const body = '- [ ] Call the plumber about the leaking kitchen tap tomorrow\n- [x] Buy replacement washers for the bathroom sink\nRead https://example.com/guide about fixing taps properly at home\nThe old cottage pipes rattle loudly whenever someone runs hot water.';
  const x = pickExcerpt(body, '', '');
  check(x?.text === '…The old cottage pipes rattle loudly whenever someone runs hot water.', 'checklist and URL lines skipped', x?.text);
  check(pickExcerpt('- [ ] one two three four five six seven\nSee www.example.org for all the many details here', '', '') === null, 'only checklist/URL sentences → null');
}
// 5. 140-char trim at a word boundary.
{
  const long = 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris.';
  const x = pickExcerpt(long, '', '')!;
  const core = x.text.replace(/…$/, '');
  check(x.text.endsWith('…') && !x.text.startsWith('…'), 'cut sentence ends with "…", first sentence has no leading "…"', x.text);
  check(core.length <= 140 && long.startsWith(core) && long[core.length] === ' ', 'cut at a word boundary within 140 chars', core.length);
  const second = pickExcerpt('Short intro line only here. ' + long, 'Short intro line only here.', '')!;
  check(second.text.startsWith('…Lorem') && second.text.endsWith('…'), 'non-first sentence gets "…" at both ends', second.text);
  const late = pickExcerpt(long, '', 'laboris')!;
  check(slices(late)[0] === 'laboris' && late.text.startsWith('…') && late.text.replace(/^…|…$/g, '').length <= 140, 'late query hit stays visible after the trim', late);
}
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
