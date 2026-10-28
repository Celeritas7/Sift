// Browser-side Google Takeout import: unzip → parse Keep JSON/HTML → dedupe by content hash → insert → refresh links.
import { unzip } from 'fflate';
import { parseKeepHtml, parseKeepJson, sha256, type ParsedNote } from '../keepImport';
import { useStore, type NewNote } from '../state/store';
import { suggestFor, type NoteV } from '../state/derived';
import { db } from './db';
import { cloud } from './supabase';
import { topicForLabel } from './config';
import { todosFromBody } from './parse';
import type { TrigramIndex } from '../similarity';
import type { Topic } from '../types';

export interface ImportStats { files: number; imported: number; skipped: number; languages: number; }
type Progress = (pct: number, stage: string) => void;
const IMG = /\.(png|jpe?g|gif|webp|heic)$/i;
const base = (p: string) => p.split('/').pop() || p;
const stem = (p: string) => base(p).replace(/\.[^.]+$/, '');
const PRIVATE = /^(private|vault|secret|personal)$/i;

async function expand(files: File[]): Promise<Map<string, Uint8Array>> {
  const out = new Map<string, Uint8Array>();
  for (const f of files) {
    const name = (f as File & { relPath?: string }).relPath || f.webkitRelativePath || f.name;
    if (/\.zip$/i.test(f.name)) {
      const data = new Uint8Array(await f.arrayBuffer());
      const entries = await new Promise<Record<string, Uint8Array>>((res, rej) => unzip(data, { filter: e => /\.(json|html?)$/i.test(e.name) || IMG.test(e.name) }, (err, r) => (err ? rej(err) : res(r))));
      Object.entries(entries).forEach(([k, v]) => out.set(k, v));
    } else out.set(name, new Uint8Array(await f.arrayBuffer()));
  }
  return out;
}

const toDataUrl = (bytes: Uint8Array, name: string) => new Promise<string>(res => {
  const ext = name.split('.').pop()!.toLowerCase(); const type = ext === 'jpg' ? 'image/jpeg' : 'image/' + ext;
  const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(new Blob([bytes as BlobPart], { type }));
});

function topicFor(p: ParsedNote, index: TrigramIndex, open: NoteV[]): Topic {
  for (const l of p.labels) { const t = topicForLabel(l); if (t) return t; }
  const s = suggestFor(index, open, p.title + ' ' + p.body);
  return s.related[0] && s.related[0].sim >= 0.15 ? s.related[0].n.topic : 'scrap';
}

export async function runImport(files: File[], progress: Progress, index: TrigramIndex, open: NoteV[]): Promise<ImportStats> {
  const st = useStore.getState(); const dec = new TextDecoder();
  progress(5, 'Reading Takeout/Keep…');
  const entries = await expand(files);
  const paths = [...entries.keys()];
  const jsonStems = new Set(paths.filter(p => /\.json$/i.test(p)).map(stem));
  const images = new Map(paths.filter(p => IMG.test(p)).map(p => [base(p), p]));
  const noteFiles = paths.filter(p => /\.json$/i.test(p) || (/\.html?$/i.test(p) && !jsonStems.has(stem(p)))); // Takeout writes both per note: prefer JSON

  progress(25, 'Parsing JSON and HTML notes…');
  const known = new Set(Object.values(st.notes).map(n => n.content_hash).filter(Boolean));
  const imported = new Set((await db().importFiles.toArray()).map(f => f.file_name + '|' + f.content_hash));
  const list: NewNote[] = []; const fileRows: { file_name: string; content_hash: string; note_id: string | null }[] = []; let skipped = 0;
  for (let i = 0; i < noteFiles.length; i++) {
    const path = noteFiles[i], file = base(path); let p: ParsedNote;
    try {
      const raw = dec.decode(entries.get(path)!);
      if (/\.json$/i.test(path)) { const j = JSON.parse(raw); if (!('textContent' in j || 'listContent' in j || 'title' in j)) continue; p = parseKeepJson(file, raw); }
      else { if (!/class="?note/i.test(raw) && !/class="?content/i.test(raw)) continue; p = parseKeepHtml(file, raw); }
    } catch { skipped++; continue; }
    if (p.trashed || (!p.title.trim() && !p.body.trim())) { skipped++; continue; }
    const hash = await sha256(p.title + '\n' + p.body);
    if (known.has(hash) || imported.has(file + '|' + hash)) { skipped++; continue; }
    known.add(hash);
    const id = crypto.randomUUID(); const topic = topicFor(p, index, open);
    const imgPath = p.attachments.map(a => images.get(base(a))).find(Boolean);
    const image = imgPath ? { path: cloud ? `${st.userId}/${base(imgPath)}` : `local/${base(imgPath)}`, dataUrl: await toDataUrl(entries.get(imgPath)!, imgPath) } : null;
    const todos = p.todos.length ? p.todos : todosFromBody(p.body);
    const title = p.title.trim() || (p.body.split('\n').find(l => l.trim()) || '').replace(/^[-*]\s+\[[ x]?\]\s*/i, '').slice(0, 70);
    const created = p.created ? new Date(p.created).toISOString() : undefined, edited = p.edited ? new Date(p.edited).toISOString() : created;
    list.push({ id, title, body: p.body, topic, labels: p.labels.filter(l => !PRIVATE.test(l)), ctx: [], pinned: p.pinned, archived: p.archived,
      vault: p.labels.some(l => PRIVATE.test(l)), lang: p.lang, todos, source: p.source, source_file: file, content_hash: hash, color: p.color ?? null,
      created_at: created, edited_at: edited, image });
    fileRows.push({ file_name: file, content_hash: hash, note_id: id });
    if (i % 25 === 0) progress(25 + Math.round(i / noteFiles.length * 40), 'Parsing JSON and HTML notes…');
  }

  progress(70, 'Finding threads and near-duplicates…');
  for (let i = 0; i < list.length; i += 200) {
    await useStore.getState().addNotes(list.slice(i, i + 200), fileRows.slice(i, i + 200));
    progress(70 + Math.round((i + 200) / Math.max(1, list.length) * 25), 'Finding threads and near-duplicates…');
  }
  await useStore.getState().refreshLinks().catch(() => {});
  progress(100, 'Done');
  return { files: noteFiles.length, imported: list.length, skipped, languages: new Set(list.map(n => n.lang).filter(l => l !== '—')).size };
}

/** Files from a drop, walking dropped folders (e.g. Takeout/Keep). */
export async function filesFromDrop(dt: DataTransfer): Promise<File[]> {
  const items = [...dt.items].map(i => i.webkitGetAsEntry?.()).filter(Boolean) as FileSystemEntry[];
  if (!items.length) return [...dt.files];
  const out: File[] = [];
  const walk = async (e: FileSystemEntry, prefix: string): Promise<void> => {
    if (e.isFile) { const f = await new Promise<File>((res, rej) => (e as FileSystemFileEntry).file(res, rej)); (f as File & { relPath?: string }).relPath = prefix + f.name; out.push(f); return; }
    const reader = (e as FileSystemDirectoryEntry).createReader();
    for (;;) { const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej)); if (!batch.length) break; for (const c of batch) await walk(c, prefix + e.name + '/'); }
  };
  for (const e of items) await walk(e, '');
  return out;
}
