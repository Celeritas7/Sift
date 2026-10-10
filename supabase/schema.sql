-- Sift schema for Supabase (Postgres). Run in SQL editor. Requires: pg_trgm, vector, pgcrypto.
create extension if not exists pg_trgm;
create extension if not exists vector;
create extension if not exists pgcrypto;

-- Existing table (reference only, do NOT recreate):
-- public.authentication_mode_user_roles(id, email, role text 'admin'|'operator', name, created_at, updated_at, auth_user_id uuid, timezone)
create or replace function public.sift_is_admin() returns boolean language sql stable as $$
  select exists(select 1 from public.authentication_mode_user_roles r where r.auth_user_id = auth.uid() and r.role = 'admin');
$$;

create table if not exists public.sift_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default '',
  body text not null default '',
  summary text,
  summary_orig text,
  lang text,                         -- EN | JA | MR | MY | —
  topic text not null default 'scrap', -- eng|soft|lang|refl|career|scrap (or user topics)
  labels text[] not null default '{}',
  ctx text[] not null default '{}',
  pinned boolean not null default false,
  archived boolean not null default false,
  vault boolean not null default false,
  color text,
  source text not null default 'sift',  -- sift | keep-json | keep-html
  source_file text,
  content_hash text,
  image_path text,                   -- storage path in keep-attachments
  created_at timestamptz not null default now(),
  edited_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.sift_notes (user_id, created_at desc);
create index sift_notes_trgm on public.sift_notes using gin ((title || ' ' || body) gin_trgm_ops);
create unique index sift_notes_hash on public.sift_notes (user_id, content_hash) where content_hash is not null;

create table if not exists public.sift_todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  note_id uuid not null references public.sift_notes(id) on delete cascade,
  ord int not null default 0,
  text text not null,
  done boolean not null default false,
  wf_board_id text,                  -- 'my_week' when linked
  wf_item_key text,                  -- e.g. 'app:roadmap'
  wf_subtask_id text,                -- subtask id inside payload.subtasks
  updated_at timestamptz not null default now()
);
create index on public.sift_todos (user_id, done);

create table if not exists public.sift_note_links (
  user_id uuid not null,
  a uuid not null references public.sift_notes(id) on delete cascade,
  b uuid not null references public.sift_notes(id) on delete cascade,
  sim real not null,
  method text not null default 'trgm', -- trgm | embed
  primary key (a, b, method),
  check (a < b)
);

create table if not exists public.sift_note_layout (
  user_id uuid not null default auth.uid(),
  note_id uuid not null references public.sift_notes(id) on delete cascade,
  layout text not null default 'map' check (layout in ('map', 'collage')),
  seed int not null default 0,       -- collage: the scatter shuffle these positions belong to
  x real not null, y real not null,  -- map: x 0..100, y 0..62.5 · collage: px on the scatter board
  primary key (user_id, note_id, layout)
);

create table if not exists public.sift_import_files (
  user_id uuid not null default auth.uid(),
  file_name text not null,
  content_hash text not null,
  note_id uuid references public.sift_notes(id) on delete set null,
  imported_at timestamptz not null default now(),
  primary key (user_id, file_name, content_hash)
);

create table if not exists public.sift_digests (
  user_id uuid not null default auth.uid(),
  week_of date not null,             -- Monday
  text text,
  wf_line text,
  generated_by text,                 -- 'ai' | 'manual'
  updated_at timestamptz not null default now(),
  primary key (user_id, week_of)
);

create table if not exists public.sift_settings (
  user_id uuid primary key default auth.uid(),
  vault_pin_hash text,               -- crypt(pin, gen_salt('bf'))
  monday_digest boolean not null default true,
  idle_seconds int not null default 60,
  ambient_seconds int not null default 20,
  theme text not null default 'light',
  collage jsonb,                     -- Collage mode: pad text, marks, muted paragraphs, note colour, tilt
  updated_at timestamptz not null default now()
);

-- Near-duplicate pairs the user chose to keep ("Keep both" on the Conflicts screen). a < b.
create table if not exists public.sift_conflict_dismissals (
  user_id uuid not null default auth.uid(),
  a uuid not null references public.sift_notes(id) on delete cascade,
  b uuid not null references public.sift_notes(id) on delete cascade,
  primary key (user_id, a, b)
);

create table if not exists public.note_embeddings (
  note_id uuid primary key references public.sift_notes(id) on delete cascade,
  user_id uuid not null,
  embedding vector(1024),
  model text,
  updated_at timestamptz not null default now()
);

-- RLS: owner or admin
alter table public.sift_notes enable row level security;
alter table public.sift_todos enable row level security;
alter table public.sift_note_links enable row level security;
alter table public.sift_note_layout enable row level security;
alter table public.sift_import_files enable row level security;
alter table public.sift_digests enable row level security;
alter table public.sift_settings enable row level security;
alter table public.note_embeddings enable row level security;
alter table public.sift_conflict_dismissals enable row level security;
do $$ declare t text; begin
  foreach t in array array['sift_notes','sift_todos','sift_note_links','sift_note_layout','sift_import_files','sift_digests','sift_settings','note_embeddings','sift_conflict_dismissals'] loop
    execute format('drop policy if exists %I_owner on public.%I', t, t);
    execute format('create policy %I_owner on public.%I for all using (user_id = auth.uid() or public.sift_is_admin()) with check (user_id = auth.uid())', t, t);
  end loop; end $$;

-- updated_at trigger
create or replace function public.sift_touch() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists sift_notes_touch on public.sift_notes; create trigger sift_notes_touch before update on public.sift_notes for each row execute function public.sift_touch();
drop trigger if exists sift_todos_touch on public.sift_todos; create trigger sift_todos_touch before update on public.sift_todos for each row execute function public.sift_touch();

-- Relevance (pg_trgm). Returns neighbours above threshold for one note.
create or replace function public.sift_similar_notes(p_note uuid, p_min real default 0.15, p_limit int default 10)
returns table(note_id uuid, sim real) language sql stable as $$
  select n2.id, similarity(n1.title || ' ' || n1.body, n2.title || ' ' || n2.body) as sim
  from public.sift_notes n1 join public.sift_notes n2 on n2.user_id = n1.user_id and n2.id <> n1.id and n2.deleted_at is null
  where n1.id = p_note
    and similarity(n1.title || ' ' || n1.body, n2.title || ' ' || n2.body) >= p_min
  order by sim desc limit p_limit;
$$;

-- Rebuild all trigram links for the current user (call after import or edits).
create or replace function public.sift_refresh_links(p_min real default 0.15)
returns int language plpgsql security invoker as $$
declare n int; begin
  delete from public.sift_note_links where user_id = auth.uid() and method = 'trgm';
  insert into public.sift_note_links(user_id, a, b, sim, method)
  select a.user_id, least(a.id,b.id), greatest(a.id,b.id), similarity(a.title||' '||a.body, b.title||' '||b.body), 'trgm'
  from public.sift_notes a join public.sift_notes b on b.user_id = a.user_id and a.id < b.id
  where a.user_id = auth.uid() and a.deleted_at is null and b.deleted_at is null
    and similarity(a.title||' '||a.body, b.title||' '||b.body) >= p_min
  on conflict do nothing;
  get diagnostics n = row_count; return n;
end $$;

-- Near-duplicate pairs (conflicts): links with sim >= 0.9
create or replace view public.sift_conflicts as
  select * from public.sift_note_links where sim >= 0.9 and method = 'trgm';

-- Weekly Focus bridge (table already exists: weekly_focus_entries(board_id, item_key, payload jsonb, ...)).
-- Flat read model of subtasks for Sift; Sift writes by updating payload.subtasks of the item row.
create or replace view public.wf_subtasks_flat as
  select e.board_id, e.item_key, s->>'id' as subtask_id, s->>'t' as title,
         (s->>'done')::boolean as done, (s->>'lat')::boolean as parked, s->>'when' as when_date,
         s->>'md' as mode, (s->>'urg')::boolean as urgent, (s->>'dl')::boolean as deadline,
         s->'ctx' as ctx, s->>'src' as src, (s->>'u')::bigint as u_ms
  from public.weekly_focus_entries e, jsonb_array_elements(e.payload->'subtasks') s
  where e.item_key <> '__board' and coalesce((s->>'del')::boolean,false) = false;

-- Storage bucket for Keep attachments (run once; or create in dashboard)
insert into storage.buckets (id, name, public) values ('keep-attachments','keep-attachments', false) on conflict do nothing;
drop policy if exists keep_att_owner on storage.objects;
create policy keep_att_owner on storage.objects for all
  using (bucket_id = 'keep-attachments' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'keep-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

-- Vault PIN helpers
create or replace function public.sift_set_pin(p_pin text) returns void language sql security definer set search_path = public, extensions as $$
  insert into public.sift_settings(user_id, vault_pin_hash) values (auth.uid(), crypt(p_pin, gen_salt('bf')))
  on conflict (user_id) do update set vault_pin_hash = excluded.vault_pin_hash, updated_at = now();
$$;
create or replace function public.sift_check_pin(p_pin text) returns boolean language sql security definer set search_path = public, extensions as $$
  select coalesce((select vault_pin_hash = crypt(p_pin, vault_pin_hash) from public.sift_settings where user_id = auth.uid()), false);
$$;
create or replace function public.sift_has_pin() returns boolean language sql security definer set search_path = public as $$
  select exists(select 1 from public.sift_settings where user_id = auth.uid() and vault_pin_hash is not null);
$$;
