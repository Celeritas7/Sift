// Offline queue → Supabase, initial pull and realtime. Last write wins by updated_at.
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { CONFLICT_KEYS, db, type QueueOp, type SyncTable } from './db';
import { applyWfMutation } from './wf';
import { WF_BOARD } from './config';
import type { WfEntry, WfItemPayload } from '../types';

export interface SyncHandlers {
  onRemoteRow: (table: SyncTable, row: Record<string, unknown>, deleted: boolean) => void;
  onWfEntry: (entry: WfEntry) => void;
  onError: (msg: string) => void;
  onQueueChange: (pending: number) => void;
}
let handlers: SyncHandlers | null = null;
export const setSyncHandlers = (h: SyncHandlers) => { handlers = h; };

let timer: ReturnType<typeof setTimeout> | undefined; let flushing = false;
export async function enqueue(...ops: QueueOp[]) {
  if (!supabase) return; // local-only mode: Dexie is the source of truth
  await db().queue.bulkAdd(ops); scheduleFlush();
}
export const scheduleFlush = (ms = 300) => { if (!supabase) return; clearTimeout(timer); timer = setTimeout(() => void flush(), ms); };
export const pendingCount = () => db().queue.count();

const transient = (e: { message?: string; status?: number; code?: string } | null) => !navigator.onLine || !e || /fetch|network|timeout/i.test(e.message || '') || (e.status ?? 0) === 0 || (e.status ?? 0) >= 500;

export async function flush() {
  if (!supabase || flushing || !navigator.onLine) return; flushing = true;
  try {
    for (;;) {
      const op = await db().queue.orderBy('seq').first(); if (!op) break;
      let err: { message?: string; status?: number } | null = null;
      try { err = await run(op); } catch (e) { err = { message: String(e), status: 0 }; }
      if (err && transient(err)) break; // keep it; retried on `online` / interval
      if (err) handlers?.onError('Sync failed: ' + (err.message || 'unknown error'));
      await db().queue.delete(op.seq!);
    }
  } finally { flushing = false; handlers?.onQueueChange(await pendingCount()); }
}

async function run(op: QueueOp): Promise<{ message?: string; status?: number } | null> {
  const sb = supabase!;
  if (op.kind === 'upsert') { const r = await sb.from(op.table).upsert(op.row, { onConflict: CONFLICT_KEYS[op.table] }); return r.error ? { message: r.error.message, status: r.status } : null; }
  if (op.kind === 'delete') { let q = sb.from(op.table).delete(); Object.entries(op.match).forEach(([k, v]) => { q = q.eq(k, v as string); }); const r = await q; return r.error ? { message: r.error.message, status: r.status } : null; }
  if (op.kind === 'upload') {
    const blob = await (await fetch(op.dataUrl)).blob();
    const r = await sb.storage.from('keep-attachments').upload(op.path, blob, { upsert: true, contentType: blob.type || 'image/png' });
    return r.error ? { message: r.error.message, status: Number((r.error as { statusCode?: string }).statusCode) || 400 } : null;
  }
  // Weekly Focus: read the fresh row, replay the mutation, write the whole payload back.
  const got = await sb.from('weekly_focus_entries').select('board_id,item_key,payload').eq('board_id', WF_BOARD).eq('item_key', op.item_key).maybeSingle();
  if (got.error) return { message: got.error.message, status: got.status };
  if (!got.data) return { message: 'Weekly Focus item ' + op.item_key + ' no longer exists', status: 404 };
  const payload = applyWfMutation(got.data.payload as WfItemPayload, op.mut);
  const up = await sb.from('weekly_focus_entries').update({ payload }).eq('board_id', WF_BOARD).eq('item_key', op.item_key);
  if (up.error) return { message: up.error.message, status: up.status };
  handlers?.onWfEntry({ board_id: WF_BOARD, item_key: op.item_key, payload });
  return null;
}

/** Fetch every row of a table for this user, 1000 at a time. */
export async function fetchAll<T>(table: string, user: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const r = await supabase!.from(table).select('*').eq('user_id', user).range(from, from + 999);
    if (r.error) throw r.error; out.push(...(r.data as T[])); if (r.data.length < 1000) break;
  }
  return out;
}
export async function fetchWf(): Promise<WfEntry[]> {
  const r = await supabase!.from('weekly_focus_entries').select('board_id,item_key,payload').eq('board_id', WF_BOARD);
  if (r.error) throw r.error; return r.data as WfEntry[];
}

let channel: RealtimeChannel | null = null;
export function subscribe(user: string) {
  if (!supabase) return; unsubscribe();
  const ch = supabase.channel('sift-' + user);
  (['sift_notes', 'sift_todos', 'sift_highlights'] as const).forEach(table => ch.on('postgres_changes', { event: '*', schema: 'public', table, filter: 'user_id=eq.' + user }, p => {
    const deleted = p.eventType === 'DELETE'; handlers?.onRemoteRow(table, (deleted ? p.old : p.new) as Record<string, unknown>, deleted);
  }));
  ch.on('postgres_changes', { event: '*', schema: 'public', table: 'weekly_focus_entries', filter: 'board_id=eq.' + WF_BOARD }, p => {
    if (p.eventType !== 'DELETE') handlers?.onWfEntry(p.new as WfEntry);
  });
  channel = ch.subscribe();
}
export const unsubscribe = () => { if (channel) void supabase?.removeChannel(channel); channel = null; };

let wired = false;
export function wireBackgroundFlush() {
  if (wired || !supabase) return; wired = true;
  window.addEventListener('online', () => void flush());
  setInterval(() => void flush(), 15000);
}
