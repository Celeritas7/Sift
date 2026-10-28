import type { StreamSettings, Topic } from '../types';

export const LIGHT = { bg: '#F4F0E8', sf: '#FBF9F4', sf2: '#ECE6DA', ink: '#221E1A', mu: '#6E665E', ln: 'rgba(34,30,26,.12)', ac: '#8E5FC0', acs: 'rgba(142,95,192,.13)', acink: '#FFFFFF' };
export const DARK = { bg: '#161311', sf: '#1F1B18', sf2: '#2A2521', ink: '#EFE8DC', mu: '#9F958A', ln: 'rgba(239,232,220,.12)', ac: '#B892E3', acs: 'rgba(184,146,227,.16)', acink: '#161311' };
export type Palette = typeof LIGHT;

export interface TopicDef { id: Topic; name: string; tag: string; span: 'span 1' | 'span 2'; summary: string; hue: number | null; custom?: boolean; }
/** A topic as saved in settings.topics: the user's names, colours and added topics. Tags and layout are derived. */
export interface TopicSetting { id: string; name: string; hue: number | null; summary?: string; }

export const DEFAULT_TOPICS: TopicDef[] = [
  { id: 'eng', name: 'Engineering at work', tag: 'engineering', span: 'span 2', hue: 300, summary: 'Reference lists and work notes you come back to: part numbers, change orders, specs.' },
  { id: 'soft', name: 'Building software', tag: 'software', span: 'span 1', hue: 230, summary: 'Apps, tools and code you are building or want to build.' },
  { id: 'lang', name: 'Language learning', tag: 'language', span: 'span 1', hue: 160, summary: 'Words, grammar and the system you use to learn them.' },
  { id: 'refl', name: 'Reflections', tag: 'reflection', span: 'span 1', hue: 55, summary: 'Slower writing about life, change and how you think.' },
  { id: 'career', name: 'Career & work life', tag: 'career', span: 'span 1', hue: 20, summary: 'Reviews, plans and paperwork. This whole thread lives in your vault.' },
  { id: 'scrap', name: 'Scraps', tag: 'scraps', span: 'span 2', hue: null, summary: 'Fragments only you can decode. Worth a minute each before they go cold.' },
];
/** Built-ins that can be renamed and recoloured but never deleted (Career is the vault topic; Scraps catches everything else). */
export const BUILTIN_IDS = new Set(DEFAULT_TOPICS.map(t => t.id as string));
/** Colours offered for topics (oklch hues; null = grey). */
export const TOPIC_HUES: (number | null)[] = [300, 230, 160, 55, 20, 120, 260, 340, 90, 190, 0, null];
export const MAX_TOPICS = 16;
export const MAX_SUMMARY = 140;
/** The description a topic gets when none is saved: a built-in's own text while it keeps its original name, otherwise none. */
export const defaultSummary = (id: string, name: string) => { const b = DEFAULT_TOPICS.find(t => t.id === id); return b && b.name === name.trim() ? b.summary : ''; };

/** "Travel plans" → "travel-plans"; non-Latin names give "" (the caller falls back). */
export const slug = (name: string) => name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);

/** The live topic list from what is saved: saved order first, then any built-in missing from it. Tags follow names and stay unique. */
export function resolveTopics(saved: TopicSetting[] | null | undefined): TopicDef[] {
  if (!saved?.length) return DEFAULT_TOPICS;
  const used = new Set<string>(); const out: TopicDef[] = [];
  const uniq = (t: string) => { let x = t, i = 2; while (used.has(x)) x = t + '-' + i++; used.add(x); return x; };
  const byId = new Map(DEFAULT_TOPICS.map(t => [t.id as string, t]));
  const seen = new Set<string>();
  for (const s of saved) {
    if (!s?.id || seen.has(s.id) || typeof s.name !== 'string' || !s.name.trim()) continue; seen.add(s.id);
    const base = byId.get(s.id), name = s.name.trim().slice(0, 40);
    out.push({ id: s.id, name, hue: s.hue === null || typeof s.hue === 'number' ? s.hue : base?.hue ?? null, tag: uniq(slug(name) || base?.tag || s.id.replace(/^u_/, 'topic-')),
      span: base?.span ?? 'span 1', summary: typeof s.summary === 'string' ? s.summary.trim().slice(0, MAX_SUMMARY) : defaultSummary(s.id, name), ...(base ? {} : { custom: true }) });
  }
  DEFAULT_TOPICS.forEach(t => { if (!seen.has(t.id)) out.push({ ...t, tag: uniq(t.tag) }); });
  return out;
}
const tagMap = (list: TopicDef[]) => {
  const m: Record<string, Topic> = {};
  DEFAULT_TOPICS.forEach(t => { m[t.tag] = t.id; }); // the original tags keep working after a rename
  list.forEach(t => { m[t.tag] = t.id; });
  return m;
};

/** The current topics. Live bindings: applyTopics() swaps them when settings.topics changes, so every importer sees the new list. */
export let TOPICS: TopicDef[] = DEFAULT_TOPICS;
export let TAG_TO_TOPIC: Record<string, Topic> = tagMap(DEFAULT_TOPICS);
export function applyTopics(saved: TopicSetting[] | null | undefined) { TOPICS = resolveTopics(saved); TAG_TO_TOPIC = tagMap(TOPICS); }

export const topicName = (id: Topic | null | undefined) => TOPICS.find(t => t.id === id)?.name ?? 'Scraps';
export const topicColor = (id: Topic | null | undefined, dark: boolean) => {
  const hue = TOPICS.find(t => t.id === id)?.hue ?? null;
  return hue == null ? (dark ? '#8A8078' : '#9A9087') : `oklch(${dark ? 0.74 : 0.6} 0.13 ${hue})`;
};

export const SERIF = 'Newsreader,"Newsreader Variable",Georgia,serif';
export const MONO = '"JetBrains Mono",ui-monospace,monospace';
export const SANS = '"Helvetica Neue",Helvetica,"Noto Sans JP","Noto Sans Devanagari",sans-serif';

export const DEFAULT_STREAM: StreamSettings = { excerpt: true, group: 'month' };
export const WF_BOARD = 'my_week';
export const BASE_CTX = ['@train', '@desk', '@deep-work', '@keyboard', '@phone-only', '@needs-claude-code', '@home', '@office'];
export const LINK_HUES = [300, 230, 160, 55, 20];
/** Shown where AI would be, when Sift runs local-only (AI goes through the Supabase function). */
export const NO_AI = 'AI summaries need Sift cloud sync';
export const MAP_MAX_NODES = 150;
