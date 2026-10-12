import type { StreamSettings, Topic } from '../types';

export const LIGHT = { bg: '#F4F0E8', sf: '#FBF9F4', sf2: '#ECE6DA', ink: '#221E1A', mu: '#6E665E', ln: 'rgba(34,30,26,.12)', ac: '#8E5FC0', acs: 'rgba(142,95,192,.13)', acink: '#FFFFFF' };
export const DARK = { bg: '#161311', sf: '#1F1B18', sf2: '#2A2521', ink: '#EFE8DC', mu: '#9F958A', ln: 'rgba(239,232,220,.12)', ac: '#B892E3', acs: 'rgba(184,146,227,.16)', acink: '#161311' };
export type Palette = typeof LIGHT;

export interface TopicDef { id: Topic; name: string; tag: string; span: 'span 1' | 'span 2'; summary: string; hue: number | null; }
export const TOPICS: TopicDef[] = [
  { id: 'eng', name: 'Engineering at work', tag: 'engineering', span: 'span 2', hue: 300, summary: 'Reference lists and work notes you come back to: part numbers, change orders, specs.' },
  { id: 'soft', name: 'Building software', tag: 'software', span: 'span 1', hue: 230, summary: 'Apps, tools and code you are building or want to build.' },
  { id: 'lang', name: 'Language learning', tag: 'language', span: 'span 1', hue: 160, summary: 'Words, grammar and the system you use to learn them.' },
  { id: 'refl', name: 'Reflections', tag: 'reflection', span: 'span 1', hue: 55, summary: 'Slower writing about life, change and how you think.' },
  { id: 'career', name: 'Career & work life', tag: 'career', span: 'span 1', hue: 20, summary: 'Reviews, plans and paperwork. This whole thread lives in your vault.' },
  { id: 'scrap', name: 'Scraps', tag: 'scraps', span: 'span 2', hue: null, summary: 'Fragments only you can decode. Worth a minute each before they go cold.' },
];
export const TAG_TO_TOPIC: Record<string, Topic> = Object.fromEntries(TOPICS.map(t => [t.tag, t.id]));
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
export const NO_AI = 'Summaries arrive in a later version';
export const MAP_MAX_NODES = 150;
