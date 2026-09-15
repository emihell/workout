# req-80 — during-exercise: nav to the bottom, inline "Add note" by the title (N7, gym-flow batch 2)

**Status: BUILT AND MERGED, 2026-09-16 — branch `req-80` (`0d2b159`…`0d2b159`, 1 commit).** From Emilio's 2026-09-14 notes:
*"Previous/Skip/Next should be at the absolute bottom of the page, and Add note should be
something small beside the exercise title."*

**Gate: gym-flow feel (ux-feel).** Pairs DESIGN §4 (req-29 button placement) and req-26 (note
behind a button).

## Why

On the exercise log page, the Previous/Skip/Next controls and the note affordance sit mid-screen.
Emilio wants forward/back nav pinned to the absolute bottom (thumb reach) and "Add note" as a
small control beside the exercise title.

## The behaviour

- Move **Previous / Skip / Next** to a bottom bar, obeying **DESIGN §4** side rules
  (back/previous left, forward/next right).
- Make **"Add note"** a small control adjacent to the exercise title that reveals the note field
  (the req-26 reveal pattern); an empty note is not forced.

## Scope

- Exercise log page layout only.

## Out of scope

- What the nav buttons do; any data change.

## Acceptance criteria

- **Placement (browser):** the nav row sits at the absolute bottom; sides obey DESIGN §4.
- **Add note (browser):** the small control by the title reveals the field and saves a note;
  leaving it empty saves no note.
- **No regression:** `./check` green.
