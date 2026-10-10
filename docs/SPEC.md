# Handoff: Sift — personal notes app (Google Keep import, relevance map, Weekly Focus sync, vault)

## Overview
Sift imports a user's Google Keep notes (Google Takeout export), shows them as a dated **Stream** led by a weekly digest, links them by **topic** (Keep-style labels) and by **relevance** (text similarity) on an interactive **Map**, extracts **to-dos** and syncs them two-way with the user's existing **Weekly Focus** planner (same Supabase project), and keeps private notes in a PIN-locked **Vault**. Capture is a chat-style bottom composer with slash commands, #topic / @context autocomplete, templates, paste-to-checklist, link cards, image paste, live preview and undo.

This package turns the prototype into a **launchable PWA on Vite + React + Supabase** with Google sign-in.

## About the design files
[`prototype/Sift v3.dc.html`](prototype/Sift%20v3.dc.html), [`prototype/sift-data.js`](prototype/sift-data.js) and [`prototype/support.js`](prototype/support.js) are **design references written in HTML** — a working prototype of look and behaviour with mock data. Do **not** ship them. Recreate the UI and behaviour in the target stack below. The prototype's logic class (bottom of [`prototype/Sift v3.dc.html`](prototype/Sift%20v3.dc.html)) is the authoritative spec for behaviour: read it for exact rules (similarity, layout relaxation, parsing, sync).

## Fidelity
**High-fidelity.** Colours, type, spacing, radii and interactions are final. Match them.

## Decisions already made with the user
- Stack: **Vite + React (TypeScript)**, static PWA, no SSR.
- Backend: **Supabase** — the user's existing project that also hosts Weekly Focus.
- Auth: **Google sign-in via Supabase Auth.** Join to the existing table `public.authentication_mode_user_roles` (columns: id, email, role `admin|operator`, name, created_at, updated_at, auth_user_id uuid → auth.users.id, timezone). Sift is single-tenant per user: every Sift row carries `user_id = auth.uid()`; RLS restricts to owner. `admin` may read all rows (for support), `operator` only their own.
- Relevance engine: **both** pg_trgm (free, instant, cross-script) **and** pgvector embeddings (meaning-level; column present, filled later when AI is enabled). v1 draws links from trigram similarity; switch to embeddings when `note_embeddings` is populated.
- AI summaries / digests: **not in v1.** Keep the UI slots (Summary block, "Write digest" button) but render "Summaries arrive in a later version" and disable the buttons. Later: Supabase Edge Function calling Claude.
- Import: drag a **Takeout .zip** or pick **Keep .json/.html** files; parse **in the browser**; upload Keep image attachments to **Supabase Storage** bucket `keep-attachments`; **re-import is idempotent** (skip notes already stored, keyed by Takeout filename + content hash).
- Offline: **yes** — IndexedDB cache (Dexie) + background sync queue; last-write-wins by `updated_at`.
- Weekly Focus: shared project. Read/write its table `weekly_focus_entries (board_id, item_key, payload jsonb)` — board `my_week`; row `__board` holds `meta.weekOf`; other rows are items with `payload.subtasks[]`. Subtask fields: id, t, done, u (ms), del, when (YYYY-MM-DD), md (b|p|o), urg, dl, loc, tag (ca|cd|cw|td), ctx (['@train',…]), lat (parked) + latAt, rv (revisit date), src (origin link or null). Item payload: active, pri, objective, notes, ord, targetDone, subtasks.
- Sift→WF rule: Engineering notes → `md:'o'`, everything else `md:'p'`. Item suggestion by topic prefix: Engineering → `office:*`, Software → `app:*`, Language → `study:*`; else first active item. The user **confirms** the item before sending. Parked subtasks (`lat:true`) are **hidden** in Sift.
- Vault: **4-digit PIN** (demo 0000). Vault contains: notes flagged private at import, the whole **Career** topic, and any note the user moves there. While locked: show a **"Locked note"** placeholder row in the stream; exclude from search, Map, related, to-dos, Lens counts. Unlock lasts for the session (Phase 4 adds auto-relock after 2 min).
- Ambient: after **60 s idle** or via the header button, full-screen note that changes every **20 s**, drawn from the oldest notes not yet opened. Any key/tap exits; Space skips.
- Resurface card ("From your past") at top of Stream rotates every ~9 s through the same pool.
- Composer visible on **every screen**.

## Screens / views
Desktop frame: max-width 1240px centred; header sticky, blurred (`backdrop-filter: blur(14px)`, bg = page bg at 86%). Mobile (≤430px): header compact, pill bottom nav (6 tabs, ink background, 44px min hit), composer sits 78px above it.

### 1. Header (all screens)
- Wordmark: 9px accent dot + "Sift" (Newsreader 22/500, letter-spacing −.02em). Click → Stream.
- Search pill (max 440px, 999px radius, 1px border): "/" mono hint, input; typing shows **note hits** dropdown (6 max: colour dot, title, summary, date; Enter opens first; footer "vault notes are not searched" when locked); typing "/" shows **commands** (/new /week /map /ambient /vault /todos /import /archive /dark).
- Nav pill (desktop): Stream · Week [open WF count] · Map · Lens · To-dos [open count] · Conflicts [1]. Active = ink bg, bg-coloured text.
- Right: **Vault** button (padlock glyph, shackle lifts when open; label VAULT/OPEN, mono 10px), **Ambient** button (ring glyph), **Theme** toggle (dot).

### 2. Stream (home)
- **Resurface card**: grid `auto 1fr auto`; mono label "FROM YOUR PAST" (accent) + age; title (Newsreader 18) + summary (13, muted); 5 progress dots. Fades (opacity 0, translateY −4px, 450 ms) between notes.
- **Hero** (grid 1.3fr/1fr, gap 56, bottom border): left = mono eyebrow "WEEK OF MAR 9 · 2 NOTES", digest paragraph (Newsreader 36/300, line-height 1.28, max 28ch), Weekly Focus pill with conic progress ring ("2 of 5 Weekly Focus tasks done" → Week), ink button "Write digest" (disabled in v1), 8 week dots, "Sample mode". Right = **Write something** card (accent-tinted, "+" circle, "N" key badge) that focuses the composer; "PINNED" list rows (date mono · title · lang).
- **Filter chip** when a topic is active: "Showing [Engineering at work ×] 3 notes".
- **Months**: grid `180px 1fr`; sticky month label (Newsreader 52/300, letter-spacing −.03em) + "2026 · 3 notes" mono. Rows: grid `56px 1fr 80px`, padding 18/14, top hairline, hover bg surface; day (13) + weekday (mono 11); title (Newsreader 22/400) + chips (mono 10 uppercase 4px radius: VAULT, CONFLICT, labels); summary (14 muted, 2-line clamp); "n to-dos" accent line; right column lang (accent) + word count. Locked rows: italic muted "Locked note", "In your vault. Enter your PIN to read it.", VAULT chip.
- Empty: italic Newsreader 24/300 "Nothing here. Clear the search or filter."

### 3. Week (Weekly Focus)
- Eyebrow "WEEKLY FOCUS · MY_WEEK" + pulsing "Synced just now / Ns ago" pill. H1 "2 of 5 tasks done" (Newsreader 48/300). Copy: two-way explanation + "1 parked task is hidden."
- Item cards (auto-fit ≥280px): header key mono accent ("app:roadmap"), "P1 · 1/2", objective (Newsreader 20). Subtask rows: 18px circle check (filled accent when done), title (strikethrough when done), badges (date "Sun 5", mode personal/office/both, URGENT accent, DEADLINE tinted, @ctx plain), "↗ note title" link for tasks created from Sift.
- Footer: "Done last week" / "Carried over" dashed cards from `__board.meta.eowDone/eowCarry`.

### 4. Map
- H1 "What's near what"; copy explains colour=topic, lines=relevance, drag/pan/zoom.
- Right: **Place a thought** pill form + hint line: "Becomes a new note. Sift picks the topic and draws its links." → while typing ≥4 chars: "Will join Engineering at work · near Gripper ECN application, …" or "No close match yet. It will land in Scraps." A dashed ghost node pulses at the centre with a topic pill; dashed lines run to predicted links. After Place: tinted confirmation bar "Placed as a new note in … Linked to X (41%) and Y (22%)." with Open note / Undo; the new node is highlighted 3.5 s **only if it has links**.
- Canvas: 16/9 (max-height 620), surface bg, 18px radius. Inner layer `translate(pan) scale(zoom)`. Controls top-right: − zoom% + (0.6–2.5×, ⌘/Ctrl-wheel too) and **Reset** when edited. Top-left "Only Engineering · Show in stream · ×" when a legend topic is selected.
- Nodes: dot 10px (13px pinned, 16px hovered), 3px surface halo; label 11px, wraps to 120px, text-shadow halo, alternates above/below. Drag moves (persist per user in `note_layout`); click (<4px move) opens note. Hover isolates its edges (others 6% opacity, non-linked nodes 30%). Legend topic selected → that topic's nodes/edges full, others 20%/5%.
- Edges: accent lines, width `1 + sim·6` px, opacity `.25 + sim·.6`.
- Legend: topic pills (selected = tinted bg + accent border); footer mono "N vault notes hidden · centre = newest · line = similarity".
- **Layout algorithm** (port exactly from prototype): polar seed — topics occupy consecutive angular slots (one gap slot between topics), radius `16 + age·14` (viewBox 100×62.5 units, y scaled ×0.86), then **60 iterations of pairwise repulsion** with label footprint RX=18, RY=11 units, clamped to x∈[10,90], y∈[9,53]. User-dragged positions override.
- **Similarity** (v1, client or SQL): TF-IDF over **character trigrams**; drop trigrams present in >50% of notes; weight `(1+ln tf)·ln((N+1)/(df+0.5))`; cosine. Edge threshold **0.15** (0.06 for edges touching a note created this session). Related list threshold 0.10, top 3.

### 5. Lens
- H1 "What your notes are about". Bento grid 4 columns: Engineering span 2, Scraps span 2, others span 1; tiles 18px radius, min-height 200, alternating surface / tint / surface-2; big count (Newsreader 56/300), mono alt line, name (22), summary (13 muted). Locked topic shows "—" and "VAULT · LOCKED".
- Below: week list (label mono, note titles, state AI/written/—) + "Write one automatically every Monday" toggle; right card with digest text and button.

### 6. To-dos
- H1 "N things to do". Rows: 20px circle, text (Newsreader 18), "from <note> · date" link, right: **"→ Weekly Focus"** button or **"WF · app:roadmap"** pill when linked. Clicking send opens an inline tinted panel: "Add to [select item (suggested)] as personal · suggested — Cancel / Confirm". Ticking a linked to-do writes `done` to WF and vice-versa.

### 7. Conflicts
- H1 "One pair to resolve". Card: "98%" (Newsreader 40 accent), title, "2 copies · differ by a trailing newline", Review / Merge suggestion toggle; Review = two columns (file, date, text, facts chips); Merge = tinted proposal with sorted numbers. Footer: Keep both / Merge into one (merging archives the HTML copy) → status line + Undo.
- Detection rule: trigram cosine ≥ 0.9 between two notes = near-duplicate pair.

### 8. Note sheet (modal, 720px, 22px radius, backdrop blur 3px, slide-up 220 ms)
- Top bar: "Esc · Close", date, **Move to vault / Remove from vault**, Pin/Unpin, Archive.
- Chips + "EN · 2026-03-16….json"; title Newsreader 40/300.
- Summary block (bg, 2px accent left border): eyebrow + source + button; English summary; original-language line when present; to-dos list with WF marks.
- "RELATED BY RELEVANCE": up to 3 rows (dot, title, bar, %).
- Attached image (if any) then body text Newsreader 18/1.65.
- "A near-duplicate exists → review" button when applicable.

### 9. Composer (fixed bottom, every screen; width min(760px, 100%−48px))
- Collapsed: 1-row textarea "Write a note… press N", mic button, Save (disabled grey until text).
- Focused: accent border, deeper shadow; if empty shows **templates** row "Start from: Meeting · Idea · Journal · List" + "⌘/Ctrl + Enter saves".
- **Autocomplete** popover (340px) above the bar for `/`, `#`, `@` tokens at the caret: Commands (/todo adds "- [ ] "; /pin /vault /wf toggle flags; /meeting /idea /journal /list insert templates), Topic or label (#engineering #software #language #reflection #career #scraps + existing labels), Context (@train @desk @deep-work @keyboard @phone-only @needs-claude-code @home @office + any ctx found in WF). ↑↓ Enter/Tab Esc.
- **Live preview card** above the popover once text exists: topic pill (tap cycles; "AUTO" when inferred), flag pills (Pinned, Vault, "→ office:q4-report"), "Make checklist / Checklist ✓" toggle when a list is detected, title, #label/@ctx tags, first 4 to-dos, link cards (coloured initial, domain, path), pasted image thumbnail (×), "LINKS TO" related notes with %.
- **Parsing rules**: title = first line stripped of #/@ tokens (70 chars) or "List · n items"; checklist detected when ≥2 lines start with `- `, `* `, `[ ]`, `1.`; #tag matching a topic sets topic, other #tags become labels; @tokens become ctx; URLs become link cards; image paste → data URL (upload to Storage on save).
- **Save** (button or ⌘/Ctrl+Enter): creates note; applies flags (pin, vault, wf → subtasks created in suggested WF item with `src:'sift:<noteId>#<i>'`); clears; shows **toast** (ink pill, 6.5 s): "Saved to Engineering at work · pinned · 2 to-dos → office:q4-report" with Open / **Undo** (removes note, its WF subtasks and links).
- **Dictate**: Web Speech API (interim results); fall back to a typed demo sentence if unavailable.
- Keyboard: **N** anywhere focuses composer; Esc blurs.

### 10. Vault PIN modal
320px, 24px radius, blur 8px backdrop. "Enter PIN" (Newsreader 24), 4 dots, 3×64px round keypad (1–9, 0, ⌫), hint "Demo PIN 0000 · or type on keyboard". Wrong PIN: dots turn ink, shake 300 ms, text "Wrong PIN", clears after 450 ms.

### 11. Ambient
Full-screen page-bg overlay. Eyebrow: topic dot · age · topic. Title Newsreader 76/300 (−.035em), summary 28/300 muted (42ch). Bottom: 160px progress bar (1 s linear steps) + "Tap or press any key to return · Space for next". Crossfade 600 ms.

### 12. Import modal
Steps copy (takeout.google.com → Deselect all → Keep → Create export), dashed drop zone ".zip · .json · .html · images", progress bar with stages ("Reading Takeout/Keep…", "Parsing JSON and HTML notes…", "Finding threads and near-duplicates…"), result tiles (files read, unique notes, near-duplicate pairs, languages) and "Open the stream".

## Interactions summary
- Transitions: siftin (opacity 0→1, translateY 10px→0, 180–220 ms ease-out) for popovers/sheets; hover bg 150 ms; map transform 250 ms ease-out (none while dragging); edge opacity 200 ms.
- Escape closes sheet/search/popovers; Enter in search opens first hit or runs first command.
- Idle detection: mousemove/pointerdown/keydown/scroll/touchstart reset the timer.

## State & data
### Supabase schema → see [`supabase/schema.sql`](../supabase/schema.sql) plus later changes in [`supabase/migrations/`](../supabase/migrations/) (tables: sift_notes, sift_todos, sift_note_links, sift_note_layout, sift_import_files, sift_digests, sift_settings, note_embeddings; functions: sift_similar_notes (pg_trgm), sift_refresh_links; RLS owner + admin policies; Storage bucket keep-attachments; view wf_subtasks_flat for Weekly Focus).
### Client state (React)
view, filter, query, selectedNoteId, vaultUnlocked (session), pin modal, composer (text, caret, flags, theme override, list override, image), autocomplete, toast, map (zoom, pan, positions, hoverId, topicFilter, placed), ambient (on, index, tick), resurface index, WF cache, pending sync queue, import progress.
### Sync
- Notes/todos: Supabase realtime on sift_* tables; optimistic updates; Dexie cache; offline queue flushed on `online`.
- Weekly Focus: read `weekly_focus_entries` where board_id='my_week'; write by patching the item row's `payload.subtasks` (jsonb) in a single update with `u = now_ms`; subscribe to realtime changes on that table. Tick on a Sift to-do that has `wf_item_key` → update subtask `done`; WF change with `src` starting 'sift:' → update sift_todos.done.
### Import pipeline (browser)
unzip (fflate) → for each Keep JSON: title, textContent | listContent[{text,isChecked}], isPinned, isArchived, isTrashed (skip), labels[].name, color, createdTimestampUsec, userEditedTimestampUsec, attachments[].filePath; for each Keep HTML: .title, .content (convert <br> to newline, strip tags, decode entities), .heading (date), .label-name, .archived; detect language by script (JA: kana/kanji, MR: Devanagari, MY: Myanmar, else EN); content hash sha-256 of (title+text) → skip if exists in sift_import_files; upload attachments to Storage `keep-attachments/<user_id>/<file>`; insert; then call `sift_refresh_links(user_id)`; near-duplicate pairs = links with sim ≥ 0.9 → conflict UI.

## Design tokens
Light: bg #F4F0E8 · surface #FBF9F4 · surface-2 #ECE6DA · ink #221E1A · muted #6E665E · line rgba(34,30,26,.12) · accent #8E5FC0 · accent-soft rgba(142,95,192,.13) · on-accent #FFFFFF.
Dark: bg #161311 · surface #1F1B18 · surface-2 #2A2521 · ink #EFE8DC · muted #9F958A · line rgba(239,232,220,.12) · accent #B892E3 · accent-soft rgba(184,146,227,.16) · on-accent #161311.
Topic colours: oklch(0.60 0.13 H) light / oklch(0.74 0.13 H) dark — Engineering H=300, Software 230, Language 160, Reflections 55, Career 20, Scraps grey #9A9087 / #8A8078.
Type: Newsreader (display/body serif; opsz axis; weights 300/400/500), JetBrains Mono (meta 10–12px, letter-spacing .04–.08em uppercase for eyebrows), system sans 13–14px for UI copy; Noto Sans JP / Noto Sans Devanagari fallbacks. Scale: 10, 11, 12, 13, 14, 15, 17, 18, 21, 22, 24, 36, 40, 48, 52, 56, 76.
Radii: 4 (chips) · 8–10 (rows) · 12–14 (cards) · 18 (panels) · 22–24 (sheets) · 999 (pills). Shadows: popover 0 18px 50px rgba(0,0,0,.14–.16); sheet 0 30px 80px rgba(0,0,0,.3); composer 0 10px 30px rgba(0,0,0,.10) → focused 0 22px 60px rgba(0,0,0,.18).
Spacing: 4/6/8/10/12/14/16/18/20/22/28/32/36/44/56.

## Phases (agreed)
1. **Done in prototype** — composer, Map zoom/drag/topic highlight.
2. Note view: inline edit + save, add/remove labels.
3. Stream: excerpt line under summary, optional group-by-topic.
4. Week: drag task between items, show notes mentioning a task; Vault auto-relock 2 min; Mobile swipe (left archive, right pin); header tidy.

## Files in this package
- [`docs/prototype/Sift v3.dc.html`](prototype/Sift%20v3.dc.html) — the prototype (template + logic). Open it in a browser; needs `support.js` and `sift-data.js` beside it (they are, in `docs/prototype/`).
- [`docs/prototype/sift-data.js`](prototype/sift-data.js) — mock notes, topics, weeks, Weekly Focus sample.
- [`docs/prototype/support.js`](prototype/support.js) — prototype runtime (ignore for implementation).
- [`supabase/schema.sql`](../supabase/schema.sql) — tables, RLS, functions, storage.
- [`supabase/migrations/`](../supabase/migrations/) — changes made after the first schema; run new files in the SQL editor.
- [`supabase/weekly_focus_sample.json`](../supabase/weekly_focus_sample.json) — real shape of the Weekly Focus board.
- [`src/types.ts`](../src/types.ts) — TypeScript types for notes, todos, WF payloads.
- [`src/similarity.ts`](../src/similarity.ts) — reference implementation of trigram TF-IDF cosine + map layout (port of prototype).
- [`src/keepImport.ts`](../src/keepImport.ts) — Takeout parser reference.
- [`docs/SETUP.md`](SETUP.md) — Supabase + Google auth + Vite steps.
- [`docs/COLLAGE.md`](COLLAGE.md) — Collage mode spec.
