import { create } from 'zustand';
import type { CollageSettings, ConflictDismissal, Digest, Highlight, HighlightColor, ImportFile, LayoutKind, LayoutRow, Note, Profile, Settings, Todo, Topic, WfEntry, WfItemPayload, WfMutation } from '../types';
import { db, getMeta, openDb, setMeta, type QueueOp, type SyncTable } from '../lib/db';
import { cloud, LOCAL_USER, supabase } from '../lib/supabase';
import { enqueue, fetchAll, fetchWf, flush, pendingCount, setSyncHandlers, subscribe, wireBackgroundFlush } from '../lib/sync';
import { applyWfMutation, isItem, newSubtask } from '../lib/wf';
import { nowIso, uid } from '../lib/format';
import { sha256 } from '../keepImport';
import { WF_BOARD } from '../lib/config';
import { DEFAULT_COLLAGE } from '../lib/collage';
import { anchor, anchorAll } from '../lib/highlights';
import wfSample from '../../supabase/weekly_focus_sample.json';

export type View = 'stream' | 'week' | 'map' | 'collage' | 'lens' | 'todos' | 'conflicts' | 'archive';
export interface NewNote {
  id?: string; title: string; body: string; topic: Topic; labels?: string[]; ctx?: string[]; pinned?: boolean; vault?: boolean; archived?: boolean;
  todos?: { text: string; done: boolean }[]; source?: Note['source']; source_file?: string | null; content_hash?: string | null; color?: string | null;
  lang: Note['lang']; created_at?: string; edited_at?: string; image?: { path: string; dataUrl?: string } | null; wfItem?: string | null;
}
export interface Toast { id: string; msg: string; }
export interface MapUi { zoom: number; pan: { x: number; y: number }; topic: string | null; hover: string | null; placed: string | null; dragging: string | null; }

const DEFAULT_SETTINGS = (user: string): Settings => ({ user_id: user, monday_digest: true, idle_seconds: 60, ambient_seconds: 20, theme: 'light', updated_at: nowIso() });
const pairKey = (a: string, b: string) => (a < b ? a + '|' + b : b + '|' + a);
const byId = <T,>(rows: T[], k: (r: T) => string) => Object.fromEntries(rows.map(r => [k(r), r])) as Record<string, T>;
const newer = (remote: { updated_at?: string }, local?: { updated_at?: string }) => !local || Date.parse(remote.updated_at || '') >= Date.parse(local.updated_at || '');
const LOCAL_SALT = 'sift-local-vault:';
export type Positions = Record<string, { x: number; y: number }>;
const NO_LAYOUT = (): Record<LayoutKind, Positions> => ({ map: {}, collage: {} });
/** Saved positions by layout. Collage keeps only the current shuffle's rows. */
const groupLayout = (rows: LayoutRow[], seed: number) => {
  const out = NO_LAYOUT();
  rows.forEach(r => { const k = r.layout ?? 'map'; if (k === 'collage' && (r.seed ?? 0) !== seed) return; out[k][r.note_id] = { x: r.x, y: r.y }; });
  return out;
};
const collageSeed = (s: Settings | null | undefined) => s?.collage?.seed ?? 0;
const collageOf = (s: Settings | null | undefined): CollageSettings => ({ ...DEFAULT_COLLAGE, ...(s?.collage ?? {}) });
let collageTimer: ReturnType<typeof setTimeout> | undefined;

interface State {
  phase: 'boot' | 'signedOut' | 'ready'; userId: string; profile: Profile | null;
  notes: Record<string, Note>; todos: Record<string, Todo>; highlights: Record<string, Highlight>; layout: Record<LayoutKind, Positions>;
  wf: Record<string, WfEntry>; wfSyncedAt: number; dismissed: Record<string, true>; digests: Record<string, Digest>; settings: Settings;
  pending: number; error: string | null; hasPin: boolean; pinIsDemo: boolean;
  view: View; filter: string; query: string; selId: string | null; unlocked: boolean; collage: CollageSettings;
  pin: { open: boolean; mode: 'enter' | 'set'; after: string | null }; toast: Toast | null; importOpen: boolean;
  ambient: boolean; opened: Record<string, true>; sessionNew: Record<string, true>; composerFocused: boolean; sendFor: string | null; sendItem: string | null; map: MapUi; week: string | null;

  init(user: string, profile?: Profile | null): Promise<void>;
  setSignedOut(): void;
  set(p: Partial<State>): void;
  setMap(p: Partial<MapUi>): void;
  go(view: View): void;
  openNote(id: string): void;
  askPin(after?: string | null, mode?: 'enter' | 'set'): void;
  checkPin(pin: string): Promise<'ok' | 'wrong' | 'offline'>;
  setPin(pin: string): Promise<boolean>;
  lock(): void;
  showToast(t: Toast | null): void;
  addNotes(list: NewNote[], files?: Omit<ImportFile, 'user_id' | 'imported_at'>[]): Promise<Note[]>;
  removeNote(id: string): Promise<void>;
  updateNote(id: string, patch: Partial<Note>): Promise<void>;
  toggleTodo(id: string): Promise<void>;
  sendTodo(todoId: string, itemKey: string): Promise<void>;
  toggleWfSubtask(itemKey: string, subId: string): Promise<void>;
  mutateWf(itemKey: string, mut: WfMutation): Promise<void>;
  setLayout(kind: LayoutKind, noteId: string, x: number, y: number): Promise<void>;
  /** Forget every saved position of one layout (the other layout is untouched). */
  resetLayout(kind: LayoutKind): Promise<void>;
  dismissPair(a: string, b: string, on: boolean): Promise<void>;
  setSettings(p: Partial<Settings>): Promise<void>;
  /** Update Collage state now; saved to sift_settings.collage 600 ms after the last change. */
  setCollage(p: Partial<CollageSettings>): void;
  /** Highlight body[s, e) of a note. Inside an existing highlight: recolour it; overlapping ones are merged into one. */
  addHighlight(noteId: string, s: number, e: number, color: HighlightColor): Promise<void>;
  removeHighlight(id: string): Promise<void>;
  /** New scatter seed: forgets the old shuffle's positions and saves the seed right away. */
  shuffleCollage(): Promise<void>;
  refreshLinks(): Promise<void>;
}

export const useStore = create<State>()((set, get) => {
  /** Write rows to Dexie and queue them for Supabase. */
  const persist = async (ops: QueueOp[]) => { await enqueue(...ops); if (cloud) set({ pending: await pendingCount() }); };
  const upsertOp = (table: SyncTable, row: object): QueueOp => ({ kind: 'upsert', table, row: row as Record<string, unknown> });
  const saveOpened = (o: Record<string, true>) => { try { localStorage.setItem('sift-opened-' + get().userId, JSON.stringify(o)); } catch { /* storage unavailable */ } };

  /** After note text changes: move highlights to where their quote now sits, and drop those whose quote is gone. */
  async function reanchor(noteIds: Set<string>) {
    const st = get(); const moved: Highlight[] = [], gone: string[] = [];
    Object.values(st.highlights).forEach(h => {
      const n = st.notes[h.note_id]; if (!noteIds.has(h.note_id) || !n) return;
      const at = anchor(n.body, h); if (at == null) gone.push(h.id); else if (at !== h.start) moved.push({ ...h, start: at, updated_at: nowIso() });
    });
    if (!moved.length && !gone.length) return;
    const next = { ...get().highlights }; moved.forEach(h => { next[h.id] = h; }); gone.forEach(id => { delete next[id]; }); set({ highlights: next });
    await db().highlights.bulkPut(moved); await db().highlights.bulkDelete(gone);
    await persist([...moved.map(h => upsertOp('sift_highlights', h)), ...gone.map((id): QueueOp => ({ kind: 'delete', table: 'sift_highlights', match: { id } }))]);
  }

  async function applyRemote(table: SyncTable, row: Record<string, unknown>, deleted: boolean) {
    if (table === 'sift_notes') {
      const id = row.id as string, local = get().notes[id];
      if (deleted) { if (!local) return; const { [id]: _, ...rest } = get().notes; set({ notes: rest }); await db().notes.delete(id); return; }
      if (!newer(row as unknown as Note, local)) return;
      set({ notes: { ...get().notes, [id]: row as unknown as Note } }); await db().notes.put(row as unknown as Note);
      if (local && local.body !== row.body) await reanchor(new Set([id]));
    } else if (table === 'sift_highlights') {
      const id = row.id as string, local = get().highlights[id];
      if (deleted) { if (!local) return; const { [id]: _, ...rest } = get().highlights; set({ highlights: rest }); await db().highlights.delete(id); return; }
      if (!newer(row as unknown as Highlight, local)) return;
      set({ highlights: { ...get().highlights, [id]: row as unknown as Highlight } }); await db().highlights.put(row as unknown as Highlight);
    } else if (table === 'sift_todos') {
      const id = row.id as string, local = get().todos[id];
      if (deleted) { if (!local) return; const { [id]: _, ...rest } = get().todos; set({ todos: rest }); await db().todos.delete(id); return; }
      if (!newer(row as unknown as Todo, local)) return;
      set({ todos: { ...get().todos, [id]: row as unknown as Todo } }); await db().todos.put(row as unknown as Todo);
    }
  }

  async function applyWfEntry(entry: WfEntry) {
    if (!get().userId) return;
    // Replay our own queued mutations on top, so a stale realtime echo never undoes an optimistic tick.
    const queued = (await db().queue.toArray()).filter((o): o is Extract<QueueOp, { kind: 'wf' }> => o.kind === 'wf' && o.item_key === entry.item_key);
    let e = entry; if (isItem(e)) { let p = e.payload; queued.forEach(o => { p = applyWfMutation(p, o.mut); }); e = { ...e, payload: p }; }
    set({ wf: { ...get().wf, [e.item_key]: e }, wfSyncedAt: Date.now() }); await db().wf.put(e);
    if (!isItem(e)) return;
    // WF → Sift: subtasks created from Sift carry src 'sift:<noteId>#<i>'; mirror their done state onto sift_todos.
    const todos = Object.values(get().todos); const changed: Todo[] = []; const next = { ...get().todos };
    e.payload.subtasks.forEach(s => {
      if (!(s.src || '').startsWith('sift:')) return; const t = todos.find(x => x.wf_subtask_id === s.id); if (!t || t.done === s.done) return;
      if (t.updated_at && Date.parse(t.updated_at) > s.u) return;
      const nt = { ...t, done: s.done, updated_at: nowIso() }; next[t.id] = nt; changed.push(nt);
    });
    if (changed.length) { set({ todos: next }); await db().todos.bulkPut(changed); await persist(changed.map(t => upsertOp('sift_todos', t))); }
  }

  async function pull(user: string) {
    if (!supabase || !navigator.onLine) return;
    try {
      const queued = await db().queue.toArray();
      const pendingIds = new Set(queued.flatMap(o => (o.kind === 'upsert' ? [String(o.row.id ?? o.row.note_id ?? '')] : [])));
      const [notes, todos, layout, digests, settings, dismissals, files] = await Promise.all([
        fetchAll<Note>('sift_notes', user), fetchAll<Todo>('sift_todos', user), fetchAll<LayoutRow>('sift_note_layout', user), fetchAll<Digest>('sift_digests', user),
        fetchAll<Settings>('sift_settings', user), fetchAll<ConflictDismissal>('sift_conflict_dismissals', user).catch(() => []), fetchAll<ImportFile>('sift_import_files', user),
      ]);
      const hls = await fetchAll<Highlight>('sift_highlights', user).catch(() => null); // null: table not migrated yet, keep the local cache
      const mergeRows = <T extends { id: string; updated_at?: string }>(local: Record<string, T>, remote: T[]) => {
        const out: Record<string, T> = {}; const seen = new Set<string>();
        remote.forEach(r => { seen.add(r.id); out[r.id] = newer(r, local[r.id]) ? r : local[r.id]; });
        Object.values(local).forEach(l => { if (!seen.has(l.id) && pendingIds.has(l.id)) out[l.id] = l; }); // unsynced local rows survive; others were deleted remotely
        return out;
      };
      const st = get();
      const n = mergeRows(st.notes, notes), t = mergeRows(st.todos, todos), hl = hls ? mergeRows(st.highlights, hls) : st.highlights;
      const seed = collageSeed(settings[0] ? { ...st.settings, ...settings[0] } : st.settings);
      const lay = groupLayout(layout, seed);
      (Object.keys(lay) as LayoutKind[]).forEach(k => Object.entries(st.layout[k]).forEach(([id, p]) => { if (pendingIds.has(id)) lay[k][id] = p; }));
      const layRows = (Object.keys(lay) as LayoutKind[]).flatMap(k => Object.entries(lay[k]).map(([note_id, p]): LayoutRow => ({ user_id: user, note_id, layout: k, seed: k === 'collage' ? seed : 0, ...p })));
      await db().transaction('rw', [db().notes, db().todos, db().highlights, db().layouts, db().digests, db().dismissals, db().importFiles], async () => {
        await db().notes.clear(); await db().notes.bulkPut(Object.values(n));
        await db().todos.clear(); await db().todos.bulkPut(Object.values(t));
        await db().highlights.clear(); await db().highlights.bulkPut(Object.values(hl));
        await db().layouts.clear(); await db().layouts.bulkPut(layRows);
        await db().digests.bulkPut(digests); await db().dismissals.bulkPut(dismissals); await db().importFiles.bulkPut(files);
      });
      set({ notes: n, todos: t, highlights: hl, layout: lay, digests: { ...st.digests, ...byId(digests, d => d.week_of) },
        dismissed: { ...st.dismissed, ...Object.fromEntries(dismissals.map(d => [pairKey(d.a, d.b), true as const])) },
        settings: settings[0] ? { ...st.settings, ...settings[0] } : st.settings,
        ...(settings[0]?.collage && !collageTimer ? { collage: collageOf(settings[0]) } : {}) });
      if (!settings[0]) await persist([upsertOp('sift_settings', st.settings)]);
      await reanchor(new Set(Object.values(hl).map(h => h.note_id)));
      const wf = await fetchWf(); for (const e of wf) await applyWfEntry(e);
      const has = await supabase.rpc('sift_has_pin'); if (!has.error) set({ hasPin: !!has.data });
    } catch (e) { set({ error: 'Could not reach Supabase: ' + ((e as Error).message || e) }); }
  }

  return {
    phase: 'boot', userId: '', profile: null,
    notes: {}, todos: {}, highlights: {}, layout: NO_LAYOUT(), wf: {}, wfSyncedAt: Date.now(), dismissed: {}, digests: {}, settings: DEFAULT_SETTINGS(''),
    pending: 0, error: null, hasPin: true, pinIsDemo: false,
    view: 'stream', filter: 'all', query: '', selId: null, unlocked: false, collage: DEFAULT_COLLAGE, pin: { open: false, mode: 'enter', after: null }, toast: null, importOpen: false,
    ambient: false, opened: {}, sessionNew: {}, composerFocused: false, sendFor: null, sendItem: null, week: null, map: { zoom: 1, pan: { x: 0, y: 0 }, topic: null, hover: null, placed: null, dragging: null },

    async init(user, profile = null) {
      const d = openDb(user);
      const [notes, todos, highlights, layout, wf, digests, dismissals, settings] = await Promise.all([
        d.notes.toArray(), d.todos.toArray(), d.highlights.toArray(), d.layouts.toArray(), d.wf.toArray(), d.digests.toArray(), d.dismissals.toArray(), getMeta<Settings | null>('settings', null)]);
      let opened: Record<string, true> = {}; try { opened = JSON.parse(localStorage.getItem('sift-opened-' + user) || '{}'); } catch { /* fresh */ }
      let wfRows = wf;
      if (!cloud && !wfRows.length) { wfRows = (wfSample.rows as { item_key: string; payload: unknown }[]).map(r => ({ board_id: WF_BOARD, item_key: r.item_key, payload: r.payload } as WfEntry)); await d.wf.bulkPut(wfRows); }
      let pinIsDemo = false;
      if (!cloud && !(await getMeta<string | null>('pinHash', null))) { await setMeta('pinHash', await sha256(LOCAL_SALT + '0000')); await setMeta('pinIsDemo', true); }
      if (!cloud) pinIsDemo = await getMeta('pinIsDemo', false);
      set({
        phase: 'ready', userId: user, profile, notes: byId(notes, n => n.id), todos: byId(todos, t => t.id), highlights: byId(highlights, h => h.id),
        layout: groupLayout(layout, collageSeed(settings)), wf: byId(wfRows, e => e.item_key),
        digests: byId(digests, x => x.week_of), dismissed: Object.fromEntries(dismissals.map(x => [pairKey(x.a, x.b), true as const])),
        settings: settings ?? DEFAULT_SETTINGS(user), collage: collageOf(settings), opened, pinIsDemo, unlocked: sessionStorage.getItem('sift-unlocked') === user,
      });
      if (!cloud) return;
      setSyncHandlers({
        onRemoteRow: (t, r, del) => void applyRemote(t, r, del),
        onWfEntry: e => void applyWfEntry(e),
        onError: msg => set({ error: msg }),
        onQueueChange: n => set({ pending: n }),
      });
      wireBackgroundFlush(); subscribe(user); await flush(); await pull(user);
      set({ pending: await pendingCount() });
    },
    setSignedOut: () => { clearTimeout(collageTimer); collageTimer = undefined; set({ phase: 'signedOut', userId: '', collage: DEFAULT_COLLAGE, notes: {}, todos: {}, highlights: {}, layout: NO_LAYOUT(), wf: {}, unlocked: false, selId: null }); },
    set: p => set(p),
    setMap: p => set({ map: { ...get().map, ...p } }),
    go: view => set({ view, selId: null, query: '', sendFor: null, map: { ...get().map, placed: null } }),
    openNote(id) {
      const n = get().notes[id]; if (!n) return;
      if (n.vault && !get().unlocked) { get().askPin(id); return; }
      const opened = { ...get().opened, [id]: true as const }; saveOpened(opened); set({ selId: id, opened, query: '' });
    },
    askPin: (after = null, mode) => set({ pin: { open: true, mode: mode ?? (get().hasPin ? 'enter' : 'set'), after } }),
    async checkPin(pin) {
      let ok = false;
      if (supabase) { if (!navigator.onLine) return 'offline'; const r = await supabase.rpc('sift_check_pin', { p_pin: pin }); if (r.error) return 'offline'; ok = !!r.data; }
      else ok = (await sha256(LOCAL_SALT + pin)) === (await getMeta('pinHash', ''));
      if (!ok) return 'wrong';
      const after = get().pin.after; sessionStorage.setItem('sift-unlocked', get().userId);
      set({ unlocked: true, pin: { open: false, mode: 'enter', after: null } }); if (after) get().openNote(after);
      return 'ok';
    },
    async setPin(pin) {
      if (supabase) { const r = await supabase.rpc('sift_set_pin', { p_pin: pin }); if (r.error) { set({ error: 'Could not set PIN: ' + r.error.message }); return false; } }
      else { await setMeta('pinHash', await sha256(LOCAL_SALT + pin)); await setMeta('pinIsDemo', false); }
      const after = get().pin.after; sessionStorage.setItem('sift-unlocked', get().userId);
      set({ hasPin: true, pinIsDemo: false, unlocked: true, pin: { open: false, mode: 'enter', after: null } }); if (after) get().openNote(after);
      return true;
    },
    lock: () => { sessionStorage.removeItem('sift-unlocked'); const s = get().selId; set({ unlocked: false, selId: s && get().notes[s]?.vault ? null : s }); },
    showToast: t => set({ toast: t }),

    async addNotes(list, files = []) {
      const user = get().userId, now = nowIso(); const notes: Note[] = [], todos: Todo[] = [], ops: QueueOp[] = [], tail: QueueOp[] = [];
      const wfAdds: Record<string, ReturnType<typeof newSubtask>[]> = {};
      for (const x of list) {
        const id = x.id ?? uid();
        const note: Note = { id, user_id: user, title: x.title, body: x.body, summary: null, summary_orig: null, lang: x.lang, topic: x.topic, labels: x.labels ?? [], ctx: x.ctx ?? [],
          pinned: !!x.pinned, archived: !!x.archived, vault: !!x.vault || x.topic === 'career', color: x.color ?? null, source: x.source ?? 'sift', source_file: x.source_file ?? null,
          content_hash: x.content_hash ?? null, image_path: x.image?.path ?? null, created_at: x.created_at ?? now, edited_at: x.edited_at ?? x.created_at ?? now, updated_at: now, deleted_at: null };
        notes.push(note); ops.push(upsertOp('sift_notes', note));
        (x.todos ?? []).forEach((t, i) => {
          const todo: Todo = { id: uid(), user_id: user, note_id: id, ord: i, text: t.text, done: t.done, wf_board_id: null, wf_item_key: null, wf_subtask_id: null, updated_at: now };
          if (x.wfItem) { const s = newSubtask(t.text, x.topic, x.ctx ?? [], `sift:${id}#${i}`); (wfAdds[x.wfItem] ||= []).push(s); Object.assign(todo, { wf_board_id: WF_BOARD, wf_item_key: x.wfItem, wf_subtask_id: s.id }); }
          todos.push(todo); ops.push(upsertOp('sift_todos', todo));
        });
        if (x.image?.dataUrl) { await db().images.put({ path: x.image.path, dataUrl: x.image.dataUrl }); tail.push({ kind: 'upload', path: x.image.path, dataUrl: x.image.dataUrl }); }
      }
      const fileRows: ImportFile[] = files.map(f => ({ ...f, user_id: user, imported_at: now }));
      fileRows.forEach(f => tail.push(upsertOp('sift_import_files', f)));
      await db().transaction('rw', [db().notes, db().todos, db().importFiles], async () => { await db().notes.bulkPut(notes); await db().todos.bulkPut(todos); await db().importFiles.bulkPut(fileRows); });
      const sessionNew = { ...get().sessionNew }; if (list.length <= 3) notes.forEach(n => { sessionNew[n.id] = true; });
      set({ notes: { ...get().notes, ...byId(notes, n => n.id) }, todos: { ...get().todos, ...byId(todos, t => t.id) }, sessionNew });
      await persist([...ops, ...tail]);
      for (const [k, subs] of Object.entries(wfAdds)) await get().mutateWf(k, { type: 'add', subtasks: subs });
      return notes;
    },

    async removeNote(id) {
      const st = get(); const note = st.notes[id]; if (!note) return;
      const { [id]: _, ...notes } = st.notes; const todos = Object.fromEntries(Object.entries(st.todos).filter(([, t]) => t.note_id !== id));
      const layout = NO_LAYOUT(); (Object.keys(layout) as LayoutKind[]).forEach(k => { const { [id]: __, ...rest } = st.layout[k]; layout[k] = rest; });
      const highlights = Object.fromEntries(Object.entries(st.highlights).filter(([, h]) => h.note_id !== id));
      set({ notes, todos, highlights, layout, selId: st.selId === id ? null : st.selId, toast: st.toast?.id === id ? null : st.toast, map: { ...st.map, placed: st.map.placed === id ? null : st.map.placed, hover: null } });
      await db().notes.delete(id); await db().todos.where('note_id').equals(id).delete(); await db().highlights.where('note_id').equals(id).delete(); await db().layouts.where('note_id').equals(id).delete();
      if (note.image_path) await db().images.delete(note.image_path);
      await persist([{ kind: 'delete', table: 'sift_notes', match: { id } }]); // todos, highlights, links and layout cascade
      const prefix = `sift:${id}#`;
      for (const e of Object.values(st.wf)) if (isItem(e) && e.payload.subtasks.some(s => (s.src || '').startsWith(prefix))) await get().mutateWf(e.item_key, { type: 'remove_src', prefix });
    },

    async updateNote(id, patch) {
      const n = get().notes[id]; if (!n) return;
      const next: Note = { ...n, ...patch, updated_at: nowIso() };
      if (patch.topic === 'career') next.vault = true;
      set({ notes: { ...get().notes, [id]: next } }); await db().notes.put(next); await persist([upsertOp('sift_notes', next)]);
      if (patch.body !== undefined && patch.body !== n.body) await reanchor(new Set([id]));
    },

    async toggleTodo(id) {
      const t = get().todos[id]; if (!t) return; const nt: Todo = { ...t, done: !t.done, updated_at: nowIso() };
      set({ todos: { ...get().todos, [id]: nt } }); await db().todos.put(nt); await persist([upsertOp('sift_todos', nt)]);
      if (nt.wf_item_key && nt.wf_subtask_id) await get().mutateWf(nt.wf_item_key, { type: 'set_done', id: nt.wf_subtask_id, done: nt.done });
    },

    async sendTodo(todoId, itemKey) {
      const t = get().todos[todoId], n = t && get().notes[t.note_id]; if (!t || !n) return;
      const s = newSubtask(t.text, n.topic, n.ctx, `sift:${n.id}#${t.ord}`); s.done = t.done;
      const nt: Todo = { ...t, wf_board_id: WF_BOARD, wf_item_key: itemKey, wf_subtask_id: s.id, updated_at: nowIso() };
      set({ todos: { ...get().todos, [todoId]: nt }, sendFor: null }); await db().todos.put(nt); await persist([upsertOp('sift_todos', nt)]);
      await get().mutateWf(itemKey, { type: 'add', subtasks: [s] });
    },

    async toggleWfSubtask(itemKey, subId) {
      const e = get().wf[itemKey]; if (!e || !isItem(e)) return; const s = e.payload.subtasks.find(x => x.id === subId); if (!s) return;
      const linked = Object.values(get().todos).find(t => t.wf_subtask_id === subId);
      if (linked) await get().toggleTodo(linked.id); else await get().mutateWf(itemKey, { type: 'set_done', id: subId, done: !s.done });
    },

    async mutateWf(itemKey, mut) {
      const e = get().wf[itemKey]; if (!e || !isItem(e)) return;
      const next: WfEntry = { ...e, payload: applyWfMutation(e.payload as WfItemPayload, mut) };
      set({ wf: { ...get().wf, [itemKey]: next }, wfSyncedAt: Date.now() }); await db().wf.put(next);
      await persist([{ kind: 'wf', item_key: itemKey, mut }]);
    },

    async setLayout(kind, noteId, x, y) {
      const lay = get().layout; set({ layout: { ...lay, [kind]: { ...lay[kind], [noteId]: { x, y } } } });
      const row: LayoutRow = { user_id: get().userId, note_id: noteId, layout: kind, seed: kind === 'collage' ? get().collage.seed : 0, x, y };
      await db().layouts.put(row); await persist([upsertOp('sift_note_layout', row)]);
    },
    async resetLayout(kind) {
      set({ layout: { ...get().layout, [kind]: {} }, ...(kind === 'map' ? { map: { ...get().map, zoom: 1, pan: { x: 0, y: 0 } } } : {}) });
      await db().layouts.where('layout').equals(kind).delete();
      await persist([{ kind: 'delete', table: 'sift_note_layout', match: { user_id: get().userId, layout: kind } }]);
    },

    async dismissPair(a, b, on) {
      const [x, y] = a < b ? [a, b] : [b, a]; const k = x + '|' + y; const d = { ...get().dismissed };
      if (on) d[k] = true; else delete d[k]; set({ dismissed: d });
      const row: ConflictDismissal = { user_id: get().userId, a: x, b: y };
      if (on) { await db().dismissals.put(row); await persist([upsertOp('sift_conflict_dismissals', row)]); }
      else { await db().dismissals.delete([x, y]); await persist([{ kind: 'delete', table: 'sift_conflict_dismissals', match: { ...row } }]); }
    },

    async setSettings(p) {
      const next = { ...get().settings, ...p, user_id: get().userId, updated_at: nowIso() }; set({ settings: next });
      await setMeta('settings', next); await persist([upsertOp('sift_settings', next)]);
    },

    setCollage(p) {
      set({ collage: { ...get().collage, ...p } }); clearTimeout(collageTimer);
      collageTimer = setTimeout(() => { collageTimer = undefined; void get().setSettings({ collage: get().collage }); }, 600);
    },
    async shuffleCollage() {
      clearTimeout(collageTimer); collageTimer = undefined;
      set({ collage: { ...get().collage, seed: get().collage.seed + 1 } });
      await get().resetLayout('collage'); await get().setSettings({ collage: get().collage });
    },

    async addHighlight(noteId, s, e, color) {
      const n = get().notes[noteId]; if (!n) return;
      while (s < e && /\s/.test(n.body[s])) s++; while (e > s && /\s/.test(n.body[e - 1])) e--; if (e <= s) return;
      const mine = Object.values(get().highlights).filter(h => h.note_id === noteId);
      const placed = anchorAll(n.body, mine), over = placed.filter(a => a.s < e && s < a.e), now = nowIso();
      const inside = over.find(a => a.s <= s && e <= a.e);
      let row: Highlight, drop: string[] = [];
      if (inside) row = { ...get().highlights[inside.id], start: inside.s, color, updated_at: now };
      else {
        const ns = Math.min(s, ...over.map(a => a.s)), ne = Math.max(e, ...over.map(a => a.e)); drop = over.map(a => a.id);
        row = { id: uid(), user_id: get().userId, note_id: noteId, quote: n.body.slice(ns, ne), start: ns, color, created_at: now, updated_at: now };
      }
      const next = { ...get().highlights, [row.id]: row }; drop.forEach(id => { delete next[id]; }); set({ highlights: next });
      await db().highlights.put(row); await db().highlights.bulkDelete(drop);
      await persist([...drop.map((id): QueueOp => ({ kind: 'delete', table: 'sift_highlights', match: { id } })), upsertOp('sift_highlights', row)]);
    },
    async removeHighlight(id) {
      if (!get().highlights[id]) return; const { [id]: _, ...rest } = get().highlights; set({ highlights: rest });
      await db().highlights.delete(id); await persist([{ kind: 'delete', table: 'sift_highlights', match: { id } }]);
    },

    async refreshLinks() { if (supabase && navigator.onLine) { await flush(); await supabase.rpc('sift_refresh_links'); } },
  };
});

export const LOCAL = LOCAL_USER;
