# req-103 — routine editor: two-line exercise rows, main unlabelled (gym-flow batch 4, F1)

**Status: SPEC — READY, held for Emilio's go.** Phase 1. **[ux-feel]**

From Emilio's in-app note (2026-09-17, `/routines/sess-upper`): *"This list is messy, maybe two does
within each row? Do we need to say main on each main exercise?"*

## Why

[measured] `src/views/Routine.jsx:154` builds one line per exercise:
`<name link> — Main · WU set · 3 sets · 20/22/24 kg`, with Up/Down buttons in the row's action
slot. "Main" prints on nearly every row. req-93 made main implied in the **workout** list
(`roleTag`, `ids.js:78`) but left the editor as it was.

## The behaviour

- Each exercise row is **two lines**: line 1 the exercise name (the existing link to the item
  editor); line 2 a small muted meta line: `[role tag] · WU set · N sets · kg`.
- **Main is not labelled** (the req-93 rule, via `roleTag`); warm-up / finisher / cardio keep their
  tag on the meta line. Absent role = main.
- Up/Down stay where they are and keep working.

## Scope

`src/views/Routine.jsx` (the exercise list around line 148–170); a class in `src/ui/ui.css` if needed.

## Out of scope

The role **picker** in the item editor (still lists all roles); reordering UX; the workout overview
(already req-93).

## Acceptance criteria

- **Two lines (browser):** each row shows the name on one line and the meta on a second, muted line.
- **Main unlabelled (browser):** a main exercise's row contains no "Main" text; a warm-up/finisher row
  shows its tag.
- **Failure case — minimal item:** an item with no role, no warm-up, no weights renders
  `name` + `1 set` (no stray `·` separators, no "Main").
- **No regression:** Up/Down still reorder; `./check` green.

## Decisions

- Two-line layout + main unlabelled (Emilio, 2026-09-17 note; extends req-93).
- Exact typography / spacing — implementation (CC).
