// IndexedDB cache (Dexie). One database per user so a shared device never mixes accounts.
import Dexie, { type Table } from 'dexie';
import type { ConflictDismissal, Digest, ImportFile, LayoutRow, Note, Settings, Todo, WfEntry, WfMutation } from '../types';

export type QueueOp =
  | { seq?: number; kind: 'upsert'; table: SyncTable; row: Record<string, unknown> }
  | { seq?: number; kind: 'delete'; table: SyncTable; match: Record<string, unknown> }
  | { seq?: number; kind: 'wf'; item_key: string; mut: WfMutation }
  | { seq?: number; kind: 'upload'; path: string; dataUrl: string };

export type SyncTable = 'sift_notes' | 'sift_todos' | 'sift_note_layout' | 'sift_import_files' | 'sift_digests' | 'sift_settings' | 'sift_conflict_dismissals';
export const CONFLICT_KEYS: Record<SyncTable, string> = {
  sift_notes: 'id', sift_todos: 'id', sift_note_layout: 'user_id,note_id', sift_import_files: 'user_id,file_name,content_hash',
  sift_digests: 'user_id,week_of', sift_settings: 'user_id', sift_conflict_dismissals: 'user_id,a,b',
};

export interface Meta { key: string; value: unknown; }

export class SiftDB extends Dexie {
  notes!: Table<Note, string>;
  todos!: Table<Todo, string>;
  layout!: Table<LayoutRow, string>;
  wf!: Table<WfEntry, string>;
  digests!: Table<Digest, string>;
  dismissals!: Table<ConflictDismissal, [string, string]>;
  importFiles!: Table<ImportFile, [string, string]>;
  images!: Table<{ path: string; dataUrl: string }, string>;
  queue!: Table<QueueOp, number>;
  meta!: Table<Meta, string>;
  constructor(user: string) {
    super('sift-' + user);
    this.version(1).stores({
      notes: 'id, created_at, updated_at', todos: 'id, note_id', layout: 'note_id', wf: 'item_key', digests: 'week_of',
      dismissals: '[a+b]', importFiles: '[file_name+content_hash], content_hash', images: 'path', queue: '++seq', meta: 'key',
    });
  }
}

let current: SiftDB | null = null;
export const openDb = (user: string) => { if (current?.name !== 'sift-' + user) { current?.close(); current = new SiftDB(user); } return current; };
export const db = () => { if (!current) throw new Error('db not open'); return current; };
export const getMeta = async <T,>(key: string, fallback: T): Promise<T> => ((await db().meta.get(key))?.value as T) ?? fallback;
export const setMeta = (key: string, value: unknown) => db().meta.put({ key, value });
export type { Settings };
