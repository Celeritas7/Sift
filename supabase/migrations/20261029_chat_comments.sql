-- Chat comments written by Claude ("Let them talk"): one topic reacting to another topic's note.
-- Synced across devices like highlights. Safe to run more than once.
create table if not exists public.sift_chat_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  note_id uuid not null references public.sift_notes(id) on delete cascade,
  topic text not null,
  text text not null check (char_length(text) <= 400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sift_chat_comments_note on public.sift_chat_comments (user_id, note_id);

alter table public.sift_chat_comments enable row level security;
drop policy if exists sift_chat_comments_owner on public.sift_chat_comments;
create policy sift_chat_comments_owner on public.sift_chat_comments for all using (user_id = auth.uid() or public.sift_is_admin()) with check (user_id = auth.uid());

drop trigger if exists sift_chat_comments_touch on public.sift_chat_comments;
create trigger sift_chat_comments_touch before update on public.sift_chat_comments for each row execute function public.sift_touch();

-- Realtime, like sift_notes / sift_highlights.
do $$ begin alter publication supabase_realtime add table public.sift_chat_comments; exception when duplicate_object or undefined_object then null; end $$;
