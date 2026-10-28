-- Custom topics: the user's topic list (names, colours, added topics) in settings.
-- [{ "id": "eng" | "u_xxxx", "name": "...", "hue": 300 | null, "summary": "..." }]; null means the six defaults.
-- Notes keep storing the topic id in sift_notes.topic (already free text). Safe to run more than once.
alter table public.sift_settings add column if not exists topics jsonb;
