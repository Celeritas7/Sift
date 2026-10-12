# Collage mode — implementation spec

Reference prototype: [`prototype/Sift Collage v3.dc.html`](prototype/Sift%20Collage%20v3.dc.html) (open it from `docs/prototype/`, next to `support.js` + `sift-data.js`). Recreate in React; don't ship the HTML.

## Route & entry
- New view `collage` (route `/collage`), added to the header nav and mobile bottom nav next to Map.
- Notes = all non-archived, non-trashed notes. **Vault notes are excluded** unless the vault is unlocked; footer line: "N vault notes are left out of the collage."

## Layout
- Header (sticky, blurred as elsewhere): wordmark · mono "COLLAGE" · **concept switch** `A · Sticky notes | B · Highlighters` · (B only) **Note color** swatches · flex spacer · count line `X of N notes · S sentences` · **view switch** `Board | Scatter` · **filter switch** `Hide others | Dim others` · theme toggle.
- Body grid `minmax(280px,360px) minmax(0,1fr)`, gap 28, padding 24; below 860px single column, left panel not sticky.

## Left panel — "Your writing"
1. Paste / Clear buttons (Clear also removes marks).
2. Auto-growing textarea (Newsreader 17/1.5). Behind it, a **backdrop div** with identical font/size/line-height/wrap renders the same text with `color: transparent`, and marked phrases get their mark colour as background (`box-shadow: 0 0 0 2px <bg>, inset 0 -2px 0 <line>`). Textarea background is transparent, so the colours show through. Append `"\n "` to the backdrop so a trailing newline still has height.
3. **Mark selected words**: 4 swatches (Red h25, Blue h250, Green h150, Violet h310). `pointerdown` + `preventDefault` (keeps textarea selection) → take `selectionStart..End`, trim punctuation/whitespace, length ≥ 2 → add `{text, colorIndex}` (or recolour if already marked). No selection → inline hint "Select a word in your writing first" for 2.6 s.
4. Mark chips: bg = mark colour, inset bottom line, bold text, count of notes containing it. Click text = cycle colour; × = remove.
5. **Paragraphs** list: each non-empty line block with ≥ 2 content tokens. Row: swatch (B: paragraph colour; A: yellow), 90-char excerpt, "N sentences in M notes". Click = turn off (strikethrough, 55% opacity, "Off").
- Persist `pad` text, marks and muted paragraphs in `sift_settings` (key `collage`) + Dexie; debounce 600 ms.

## Matching (client-side, no AI)
- Tokens: lowercase `\p{L}\p{N}` words, drop length < 3, digits-only and a stop list (see prototype `STOP`). Light stemmer: strip `'s`, `-ing` (len > 5), `-ed` (len > 4), `-ies→y`, `-s` (not `-ss`), then trailing `e` (len > 4). Non-ASCII words are not stemmed.
- Two stems match if equal, or both ≥ 6 chars and share the first 6.
- Note sentences: split with `/[^.!?。！？।\n]*[.!?。！？।]+|[^.!?。！？।\n]+|\n+/g` (keeps every character, so rendering is lossless).
- Per sentence, score each active paragraph = number of paragraph tokens matching any sentence token. Best paragraph wins (ties → earlier). Highlight if `score ≥ 2`, or `score = 1` and the sentence has ≤ 3 tokens.
- **Marks**: case-insensitive search in note text. Single ASCII word → search its stem, require a word boundary before, extend to the end of the word. Phrases / non-ASCII → exact substring. Remove overlaps (earliest, longest wins).
- Note passes if it has ≥ 1 highlighted sentence or ≥ 1 mark hit. Score = Σ sentence scores + 3 × mark hits. Sort: passing first → score ↓ → newest.
- Filter: Hide = only passing notes; Dim = all notes, non-passing at 35% (scatter 40%).

## Highlight rendering
Split the note text at every sentence-highlight and mark boundary; each segment gets one style:
- **Mark** (wins over sentence): solid `oklch(.80 .15 h)` (on dark cards `oklch(.56 .15 h)`), weight 700, `box-shadow: inset 0 -2px 0 oklch(.52 .19 h)`, radius 3, padding 0 2, `white-space: nowrap`.
- **Sentence**: marker stroke `linear-gradient(180deg, transparent 10%, C 10%, C 90%, transparent 90%)`, padding 0 2, `box-decoration-break: clone`. Leading/trailing whitespace of the sentence is not highlighted.
  - Concept A: C = `#FFE53B` (dark page `#F2D22E`), `mix-blend-mode: multiply`.
  - Concept B: C = paragraph colour `oklch(.88 .14 H)` (dark card `oklch(.48 .11 H)`), H cycles `95,300,160,30,230,345,125,265`.

## Concepts
- **A · Sticky notes**: card bg by topic — eng `#8FD3EE`, soft `#F7A8C8`, lang `#BDE58A`, refl `#F9B872`, career `#C9B6F2`, scrap `#E6DED0`. Ink `#221E1A` always (also in dark mode). Radius 2, no border, no tape, shadow `0 1px 1px rgba(0,0,0,.08), 0 10px 18px -6px rgba(0,0,0,.24)`. Scatter board bg `#D9CDB8` (dark `#2A241F`).
- **B · Highlighters**: user-chosen note colour — Paper (= theme surface), White `#FFFFFF`, Kraft `#E6D7BC`, Fog `#E2E6EA`, Ink `#25211E` (light ink `#EFE8DC`). Radius 4, 1px border, washi-tape strip 60×18 at top centre rotated −4…4°. Persist the choice.

## Board view
CSS columns (`column-width: 260px; gap 22`), cards `break-inside: avoid`, tilt `((hash%7)-3)·0.45°` (tilt toggle in settings). Card: mono topic + date, title Newsreader 19/500, full text 13/1.7 with highlights, footer dots (paragraph colours + mark lines) + "N sentences · paragraph 1, 3 · “Adobe”". Click → note sheet with the same highlights.

## Scatter view
- Hint line + **Shuffle** (new seed, resets positions and z-order).
- Board: `position: relative`, rounded 16, overflow hidden, height = max(560, lowest card y + card width + 140).
- Card width 250 (220 if board < 520). Per row = `floor((W − cw) / (0.7·cw)) + 1`; rows cascade every 128px with odd rows shifted half a step, plus ±20px x / 0–28px y jitter from `hash(id)+seed`; rotation ±4°. Later cards sit higher in z, so every card's top strip stays visible.
- Card content: title + date, then up to 3 **important sentences** (top scores, plus sentences containing marks), Newsreader 17 (15 if 3), in original order, with highlights.
- **Drag**: pointerdown on a card (preventDefault) brings it to the front; window pointermove moves it after > 4px; pointerup without movement opens the note. Save positions per seed in `sift_note_layout` (`layout='collage'`).
- **Phones (board < 520px)**: "Your writing" folds into a tap-to-open bar (`Your writing · N paragraphs · M marks`); the board runs edge to edge. Card width `max(190, round(W·0.64))`, zigzag left (x 8) / right (x W − cw − 8) with ±12px jitter, 140px apart, ±5°. Board bottom padded by the nav height + `env(safe-area-inset-bottom)`.
  - Default: cards `touch-action: pan-y` — tap opens, swipe scrolls, press-and-hold (250 ms) drags with `navigator.vibrate(10)`.
  - **Arrange** toggle (next to Shuffle, reads **Done** when on): cards and ghosts `touch-action: none`, drag at once, taps don't open; accent outline on the board and hint "Drag notes anywhere · tap Done to finish".
- **Free movement**: x clamped to [−cw·0.25, W − cw·0.75]; y only kept ≥ 0 and the board grows to max(560, lowest card bottom + 120). Within 60px of the viewport top/bottom a drag auto-scrolls the window (up to 12px per frame).
- **Saved positions**: x as a fraction of board width, y in px; `layout='collage-m'` on phones and `'collage'` otherwise, so the two arrangements are kept apart. Shuffle clears both.
- **Marked words are never hidden** (two top layers above all cards):
  1. *Flags* (z 9000): pills with the note's marked words, pinned 14px above the card's top-left, same rotation; pointerdown drags that card.
  2. *Ghosts* (z 9500): after every render (and on `document.fonts.ready`), find every mark span inside the cards, measure its `getBoundingClientRect()` centre relative to the board, and draw a copy at that centre with `translate(-50%,-50%) rotate(<card rotation>)`, copying the computed font-size, colour, background and box-shadow (+ `0 3px 10px rgba(0,0,0,.25)`). Pointerdown on a ghost drags its card. Only update state when the measured list changes (avoids render loops). Use a `ResizeObserver` on the board too.

## Note sheet
Same modal as elsewhere; background/ink follow the active concept; body shows the full text with highlights; footer line from the hit summary.

## Acceptance
- Typing a paragraph immediately re-filters (memoise per note; debounce 150 ms over 200 notes).
- Marking a word colours it in the textarea, every note that contains it, and the scatter overlay.
- In Scatter, drag any card over another: the covered card's marked words stay visible on top.
- Vault notes never appear while the vault is locked.
