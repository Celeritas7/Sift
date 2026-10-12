-- Stream settings: the excerpt line under each row and grouping by month or topic.
-- { "excerpt": true, "group": "month" | "topic" }; null means the defaults. Safe to run more than once.
alter table public.sift_settings add column if not exists stream jsonb;
