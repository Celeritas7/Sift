-- Manual highlights: passages the user marked in a note. Re-anchored client-side by `quote` near `start`.
-- Safe to run more than once.
create table if not exists public.sift_highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  note_id uuid not null references public.sift_notes(id) on delete cascade,
  quote text not null,
  start int not null check (start >= 0),
  color text not null default 'yellow' check (color in ('yellow', 'pink', 'green', 'blue')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sift_highlights_note on public.sift_highlights (user_id, note_id);

alter table public.sift_highlights enable row level security;
drop policy if exists sift_highlights_owner on public.sift_highlights;
create policy sift_highlights_owner on public.sift_highlights for all using (user_id = auth.uid() or public.sift_is_admin()) with check (user_id = auth.uid());

drop trigger if exists sift_highlights_touch on public.sift_highlights;
create trigger sift_highlights_touch before update on public.sift_highlights for each row execute function public.sift_touch();

-- Realtime, like sift_notes / sift_todos.
do $$ begin alter publication supabase_realtime add table public.sift_highlights; exception when duplicate_object or undefined_object then null; end $$;
