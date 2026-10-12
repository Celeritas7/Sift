-- Collage on phones: a separate saved scatter layout, 'collage-m' (x as a fraction of board width, y in px),
-- so phone and desktop arrangements don't overwrite each other. Safe to run more than once.
alter table public.sift_note_layout drop constraint if exists sift_note_layout_layout_check;
alter table public.sift_note_layout add constraint sift_note_layout_layout_check check (layout in ('map', 'collage', 'collage-m'));
