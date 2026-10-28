import { applyTopics, topicForLabel } from '../src/lib/config';
let fails = 0;
const check = (ok: boolean, msg: string, got?: unknown) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok || got === undefined ? '' : '  got ' + JSON.stringify(got))); if (!ok) fails++; };
const is = (label: string, want: string | null, msg: string) => { const got = topicForLabel(label); check(got === want, msg + ` ("${label}" → ${want})`, got); };

applyTopics(null);
is('Engineering', 'eng', 'built-in tag');
is('Engineering notes', 'eng', 'label starting with a topic word');
is('Languages', 'lang', 'plural');
is('reflections', 'refl', 'plural of the tag');
is('Language learning', 'lang', 'full name');
is('softwares-and-stuff', null, 'no match inside a word');
is('', null, 'empty label');

applyTopics([{ id: 'u_art', name: 'Art', hue: 1 }, { id: 'u_arh', name: 'Art history', hue: 2 }, { id: 'eng', name: 'Office', hue: 300 }, { id: 'u_jp', name: '旅行', hue: 3 }]);
is('artificial', null, 'short custom name no longer claims a longer word');
is('Artificial intelligence', null, 'not even at the start of a phrase');
is('art', 'u_art', 'exact custom name');
is('ART', 'u_art', 'case-insensitive');
is('Arts', 'u_art', 'plural of a custom name');
is('art projects', 'u_art', 'custom name as first word');
is('Art history', 'u_arh', 'exact match beats a shorter prefix');
is('art-history-notes', 'u_arh', 'longest prefix wins');
is('Office', 'eng', 'renamed built-in: new name');
is('engineering', 'eng', 'renamed built-in: original tag still matches');
is('旅行', 'u_jp', 'non-Latin name matches exactly');
is('旅行メモ', null, 'non-Latin names only match exactly');
applyTopics(null);
if (fails) process.exit(1); console.log('\nALL PASSED');
