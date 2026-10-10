# Sift setup (Vite + React + Supabase)

## 1. Supabase
1. Use the existing project (shared with Weekly Focus). SQL editor → run `supabase/schema.sql`. Besides the tables in the handoff, it creates `sift_conflict_dismissals` (stores "Keep both" on Conflicts) and `sift_has_pin()` (the first unlock asks you to choose a PIN).
2. Authentication → Providers → **Google**: enable; add OAuth client ID/secret from Google Cloud Console (Authorized redirect: `https://<project>.supabase.co/auth/v1/callback`). Add your app origins (localhost:5173, your host) to Redirect URLs.
3. Roles: Sift reads `public.authentication_mode_user_roles` by `auth_user_id = auth.uid()`. Rows without `auth_user_id` (Igarashi, Niidome) should be back-filled on first Google login via a trigger or by matching `email` — add:
   ```sql
   create or replace function public.link_role_on_login() returns trigger language plpgsql security definer as $$
   begin update public.authentication_mode_user_roles set auth_user_id = new.id, updated_at = now() where email = new.email and auth_user_id is null; return new; end $$;
   drop trigger if exists link_role_on_login on auth.users; create trigger link_role_on_login after insert on auth.users for each row execute function public.link_role_on_login();
   ```
4. Storage: bucket `keep-attachments` is created by the SQL (private, per-user folders).
5. Realtime: enable for `sift_notes`, `sift_todos`, `sift_highlights`, `weekly_focus_entries`.

## 2. App
```bash
npm install
cp .env.example .env      # fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev               # http://localhost:5173
npm run build             # typecheck + static PWA in dist/
```
With no Supabase values in `.env`, Sift runs **local-only**: no sign-in, data in IndexedDB, Weekly Focus seeded from `supabase/weekly_focus_sample.json`, demo vault PIN 0000 (change it with `/pin`).
Fonts are self-hosted via @fontsource. The CJK/Devanagari subsets are cached by the service worker on first use, not precached.

## 3. Structure
```
src/
  lib/supabase.ts  db.ts (Dexie)  sync.ts (queue, pull, realtime)  wf.ts (Weekly Focus)  importer.ts (Takeout)
  lib/parse.ts (composer rules)  capture.ts (text → note)  config.ts (tokens, topics)  format.ts
  similarity.ts  keepImport.ts  types.ts
  state/store.ts (zustand: data + actions)  derived.ts (vault filtering, trigram index, conflicts)  counts.ts
  screens/   Stream Week Map Lens Todos Conflicts Archive
  components/ Header Composer NoteSheet PinModal Ambient ImportModal Login
```
Search-bar commands: /new /week /map /ambient /vault /todos /import /archive /dark /pin /signout.

## 4. Weekly Focus write rule
To tick a subtask: read the item row, map `payload.subtasks` replacing the one with matching `id` (`done`, `u: Date.now()`), update the row. To add from Sift: push `{ id:'s_'+rand, t, done:false, u:Date.now(), del:false, when:'', md: topic==='eng'?'o':'p', urg:false, dl:false, loc:'', tag:'', ctx, lat:false, latAt:0, rv:'', src:'sift:<noteId>#<ord>' }`. Store `wf_item_key` + `wf_subtask_id` on `sift_todos`.

## 5. Vault
PIN is never stored in the client. `rpc('sift_set_pin', {p_pin})` once; `rpc('sift_check_pin', {p_pin})` to unlock; keep `vaultUnlocked` in memory only (sessionStorage at most). Vault notes are still fetched (RLS allows owner) but filtered out of search/map/todos until unlocked; Phase 4 adds auto-relock.

## 6. Offline
Dexie tables mirror sift_notes/sift_todos. Writes go to Dexie + a `queue` table; a flusher posts to Supabase on `online`/interval; conflicts resolve by newer `updated_at`.
