import { matchText, paragraphs } from '../src/lib/collage';
let fails = 0;
const check = (ok: boolean, msg: string, got?: unknown) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok || got === undefined ? '' : '  got ' + JSON.stringify(got))); if (!ok) fails++; };

// Collage minimum shared words: "want" and "load" are the 2 keywords shared with the paragraph.
const note = 'I want to load it in the supabase.';
const paras = paragraphs('I want to load the app quickly on my phone', []);
const at = (minWords: number) => matchText(note, paras, [], minWords).hits.length;
check(at(3) === 0, 'two shared words: no hit at minWords 3', at(3));
check(at(2) === 1, 'two shared words: hit at minWords 2', at(2));
check(at(1) === 1, 'two shared words: hit at minWords 1', at(1));
check(matchText(note, paras, []).hits.length === 0, 'default threshold is 3');
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
