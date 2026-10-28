// IndexedDB cache (Dexie). One database per user so a shared device never mixes accounts.
import Dexie, { type Table } from 'dexie';
import type { ChatComment, ConflictDismissal, Digest, Highlight, ImportFile, LayoutRow, Note, Settings, Todo, WfEntry, WfMutation } from '../types';

export type QueueOp =
  | { seq?: number; kind: 'upsert'; table: SyncTable; row: Record<string, unknown> }
  | { seq?: number; kind: 'delete'; table: SyncTable; match: Record<string, unknown> }
  | { seq?: number; kind: 'wf'; item_key: string; mut: WfMutation }
  | { seq?: number; kind: 'upload'; path: string; dataUrl: string };

export type SyncTable = 'sift_notes' | 'sift_todos' | 'sift_note_layout' | 'sift_import_files' | 'sift_digests' | 'sift_settings' | 'sift_conflict_dismissals' | 'sift_highlights' | 'sift_chat_comments';
export const CONFLICT_KEYS: Record<SyncTable, string> = {
  sift_notes: 'id', sift_todos: 'id', sift_note_layout: 'user_id,note_id,layout', sift_import_files: 'user_id,file_name,content_hash',
  sift_digests: 'user_id,week_of', sift_settings: 'user_id', sift_conflict_dismissals: 'user_id,a,b', sift_highlights: 'id', sift_chat_comments: 'id',
};

export interface Meta { key: string; value: unknown; }

export class SiftDB extends Dexie {
  notes!: Table<Note, string>;
  todos!: Table<Todo, string>;
  layouts!: Table<LayoutRow, [LayoutRow['layout'], string]>;
  highlights!: Table<Highlight, string>;
  comments!: Table<ChatComment, string>;
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
    // v2: positions are kept per layout (Map, Collage). Dexie cannot change a primary key, so copy into a new table.
    this.version(2).stores({ layouts: '[layout+note_id], note_id, layout' }).upgrade(async tx => {
      const old = await tx.table('layout').toArray() as Omit<LayoutRow, 'layout' | 'seed'>[];
      await tx.table('layouts').bulkPut(old.map(r => ({ ...r, layout: 'map', seed: 0 })));
    });
    this.version(3).stores({ layout: null });
    this.version(4).stores({ highlights: 'id, note_id' });
    this.version(5).stores({ comments: 'id, note_id' });
  }
}

let current: SiftDB | null = null;
export const openDb = (user: string) => { if (current?.name !== 'sift-' + user) { current?.close(); current = new SiftDB(user); } return current; };
export const db = () => { if (!current) throw new Error('db not open'); return current; };
export const getMeta = async <T,>(key: string, fallback: T): Promise<T> => ((await db().meta.get(key))?.value as T) ?? fallback;
export const setMeta = (key: string, value: unknown) => db().meta.put({ key, value });
export type { Settings };
