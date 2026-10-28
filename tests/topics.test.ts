import { applyTopics, DEFAULT_TOPICS, defaultSummary, resolveTopics, slug, TAG_TO_TOPIC, TOPICS, topicColor, topicName } from '../src/lib/config';
import { initials } from '../src/lib/chat';
import { parseDraft } from '../src/lib/parse';
import { checkTopicNames, digestInput } from '../supabase/functions/sift-ai/lib';
let fails = 0;
const check = (ok: boolean, msg: string, got?: unknown) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok || got === undefined ? '' : '  got ' + JSON.stringify(got))); if (!ok) fails++; };

check(resolveTopics(null) === DEFAULT_TOPICS && resolveTopics([]) === DEFAULT_TOPICS, 'nothing saved: the six defaults');
check(slug('Travel plans') === 'travel-plans' && slug('Café & Crème') === 'cafe-creme' && slug('旅行') === '', 'slugs');

const saved = [{ id: 'eng', name: 'Office', hue: 120 }, { id: 'u_trv1', name: 'Travel', hue: 340 }, { id: 'u_jp01', name: '旅行メモ', hue: null }, { id: 'u_dup', name: 'Office', hue: 1 }, { id: 'u_bad', name: '   ', hue: 2 }];
const r = resolveTopics(saved);
check(r.map(t => t.id).join() === 'eng,u_trv1,u_jp01,u_dup,soft,lang,refl,career,scrap', 'saved order first, then every built-in that was missing; blank names dropped', r.map(t => t.id));
const eng = r.find(t => t.id === 'eng')!, trv = r.find(t => t.id === 'u_trv1')!, jp = r.find(t => t.id === 'u_jp01')!;
check(eng.name === 'Office' && eng.hue === 120 && eng.tag === 'office' && !eng.custom && eng.span === 'span 2', 'renamed built-in: new name/colour/tag, keeps its layout');
check(trv.custom === true && trv.tag === 'travel' && trv.span === 'span 1' && trv.summary === '', 'custom topic: no description until one is written');
check(eng.summary === '', 'renamed built-in drops its original description (Office is not "part numbers, change orders")', eng.summary);
check(resolveTopics([{ id: 'refl', name: 'Reflections', hue: 55 }])[0].summary === DEFAULT_TOPICS[3].summary, 'built-in under its own name keeps its description');
const desc = resolveTopics([{ id: 'eng', name: 'Office', hue: 120, summary: '  Meetings and admin at the office. ' }, { id: 'u_t', name: 'Travel', hue: 1, summary: 'Trips.' }, { id: 'soft', name: 'Building software', hue: 230, summary: '' }]);
check(desc[0].summary === 'Meetings and admin at the office.' && desc[1].summary === 'Trips.', 'saved descriptions are used, trimmed', desc.map(t => t.summary));
check(desc[2].summary === '', 'a cleared built-in description stays cleared', desc[2].summary);
check(resolveTopics([{ id: 'u_l', name: 'Long', hue: 1, summary: 'x'.repeat(300) }])[0].summary.length === 140, 'descriptions capped at 140 characters');
check(defaultSummary('eng', 'Engineering at work') === DEFAULT_TOPICS[0].summary && defaultSummary('eng', 'Office') === '' && defaultSummary('u_x', 'X') === '', 'defaultSummary');
check(jp.tag === 'topic-jp01', 'non-Latin name gets a stable fallback tag', jp.tag);
check(r.find(t => t.id === 'u_dup')!.tag === 'office-2', 'clashing tags get a number', r.find(t => t.id === 'u_dup')!.tag);

applyTopics(saved);
check(TOPICS.length === 9 && topicName('u_trv1') === 'Travel' && topicName('eng') === 'Office', 'applyTopics swaps the live list (importers see it)');
check(TAG_TO_TOPIC.travel === 'u_trv1' && TAG_TO_TOPIC.office === 'eng' && TAG_TO_TOPIC.engineering === 'eng', '#tags: new names work, old built-in tags still work');
check(topicColor('u_trv1', false) === 'oklch(0.6 0.13 340)' && topicColor('u_jp01', true) === '#8A8078', 'colours from hue; null is grey');
check(topicName('u_gone') === 'Scraps', 'unknown topic id reads as Scraps');
const d = parseDraft('Book the ryokan #travel #onsen', null);
check(d.topicFromTag === 'u_trv1' && d.labels.join() === 'onsen', '#travel files the note under Travel; other tags stay labels', d);
check(initials('u_trv1') === 'TR' && initials('u_jp01') === '旅行' && initials('eng') === 'OF' && initials('scrap') === 'SC', 'chat initials from names for custom topics', [initials('u_trv1'), initials('u_jp01'), initials('eng')]);
applyTopics(null);
check(TOPICS === DEFAULT_TOPICS && TAG_TO_TOPIC.travel === undefined && initials('eng') === 'EN', 'back to defaults');

check(JSON.stringify(checkTopicNames({ eng: 'Office', u_trv1: ' Travel ', 'bad key!': 'x', u_long: 'x'.repeat(41), u_q: 'A "quoted" <b>' })) === '{"eng":"Office","u_trv1":"Travel","u_q":"A quoted b"}', 'server: topic names checked and made safe for the prompt', checkTopicNames({ eng: 'Office', u_trv1: ' Travel ', 'bad key!': 'x', u_long: 'x'.repeat(41), u_q: 'A "quoted" <b>' }));
check(checkTopicNames('nope') && Object.keys(checkTopicNames(['a'])).length === 0, 'server: non-object ignored');
check(digestInput('2026-10-19', [{ id: 'x', title: 't', body: 'b', topic: 'u_trv1', lang: 'EN', created_at: '2026-10-20T00:00:00Z' }], { u_trv1: 'Travel' }).includes('topic="u_trv1" topic_name="Travel"'), 'server: prompt names the topic');
if (fails) process.exit(1); console.log('\nALL PASSED');
