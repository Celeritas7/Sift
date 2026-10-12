// Shared types for Sift (Vite + React + Supabase)
export type Topic = 'eng' | 'soft' | 'lang' | 'refl' | 'career' | 'scrap' | (string & {});
export type Lang = 'EN' | 'JA' | 'MR' | 'MY' | '—';

export interface Note {
  id: string; user_id: string; title: string; body: string;
  summary?: string | null; summary_orig?: string | null; lang: Lang; topic: Topic;
  labels: string[]; ctx: string[]; pinned: boolean; archived: boolean; vault: boolean;
  color?: string | null; source: 'sift' | 'keep-json' | 'keep-html'; source_file?: string | null;
  content_hash?: string | null; image_path?: string | null;
  created_at: string; edited_at: string; updated_at: string; deleted_at?: string | null;
}
export interface Todo { id: string; note_id: string; ord: number; text: string; done: boolean;
  wf_board_id?: string | null; wf_item_key?: string | null; wf_subtask_id?: string | null; user_id?: string; updated_at?: string; }
export interface NoteLink { a: string; b: string; sim: number; method: 'trgm' | 'embed'; }
export interface Layout { note_id: string; x: number; y: number; }

// Weekly Focus (existing app, same Supabase project)
export type WfMode = 'b' | 'p' | 'o';
export interface WfSubtask { id: string; t: string; done: boolean; u: number; del: boolean; when: string; md: WfMode;
  urg: boolean; dl: boolean; loc: string; tag: '' | 'ca' | 'cd' | 'cw' | 'td'; ctx: string[]; lat: boolean; latAt: number; rv: string; src: string | null; }
export interface WfItemPayload { active: boolean; pri: number; objective: string; notes: string; targetDone: boolean; ord: number; subtasks: WfSubtask[]; }
export interface WfBoardMeta { weekOf: string; eowDone: string; eowCarry: string; eowNotes: string; seq: string[]; hours: { p: [string,string]; o: [string,string] }; routines: unknown[]; }
export interface WfEntry { board_id: string; item_key: string; payload: WfItemPayload | { u: number; targetOrder: string[]; meta: WfBoardMeta }; }

export const TOPIC_PREFIX: Record<string, string> = { eng: 'office:', soft: 'app:', lang: 'study:' };
export const modeForTopic = (t: Topic): WfMode => (t === 'eng' ? 'o' : 'p');

export interface Digest { user_id: string; week_of: string; text: string | null; wf_line: string | null; generated_by: 'ai' | 'manual' | null; updated_at: string; }
export interface Settings { user_id: string; monday_digest: boolean; idle_seconds: number; ambient_seconds: number; theme: 'light' | 'dark'; collage?: CollageSettings | null; stream?: Partial<StreamSettings> | null; updated_at: string; }
/** Stream screen: excerpt line under each row, and grouping by month or topic. */
export interface StreamSettings { excerpt: boolean; group: 'month' | 'topic'; }
export interface CollageMark { t: string; ci: number; }
export interface CollageSettings {
  pad: string; marks: CollageMark[]; muted: number[]; noteBg: 'paper' | 'white' | 'kraft' | 'fog' | 'ink'; tilt: boolean;
  concept: 'sticky' | 'marker'; view: 'board' | 'scatter'; filter: 'hide' | 'dim' | 'own'; seed: number;
}
export type HighlightColor = 'yellow' | 'pink' | 'green' | 'blue';
export interface Highlight { id: string; user_id: string; note_id: string; quote: string; start: number; color: HighlightColor; created_at: string; updated_at: string; }
export interface ConflictDismissal { user_id: string; a: string; b: string; }
export interface ImportFile { user_id: string; file_name: string; content_hash: string; note_id: string | null; imported_at: string; }
export type LayoutKind = 'map' | 'collage' | 'collage-m';
export interface LayoutRow { user_id: string; note_id: string; layout: LayoutKind; seed: number; x: number; y: number; }
export interface Profile { name: string | null; email: string | null; role: 'admin' | 'operator' | null; }

// Mutations on a Weekly Focus item row, replayed against the fresh row when the offline queue flushes.
export type WfMutation =
  | { type: 'set_done'; id: string; done: boolean }
  | { type: 'add'; subtasks: WfSubtask[] }
  | { type: 'remove_src'; prefix: string };
