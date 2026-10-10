-- Collage mode: per-user collage state, and a second saved layout next to the Map.
-- Safe to run more than once.

-- Pad text, marks, muted paragraphs, note colour, tilt, concept/view/filter and the scatter seed.
alter table public.sift_settings add column if not exists collage jsonb;

-- Saved card positions now belong to a layout: 'map' (x 0..100, y 0..62.5) or 'collage' (px on the scatter board).
alter table public.sift_note_layout add column if not exists layout text not null default 'map';
alter table public.sift_note_layout add column if not exists seed int not null default 0;
alter table public.sift_note_layout drop constraint if exists sift_note_layout_layout_check;
alter table public.sift_note_layout add constraint sift_note_layout_layout_check check (layout in ('map', 'collage'));
alter table public.sift_note_layout drop constraint if exists sift_note_layout_pkey;
alter table public.sift_note_layout add primary key (user_id, note_id, layout);
