# req-94 — Today: merge "Completed today" + recent into one stateful list

Branch: `req-94` (off `main`). Render structure only; no data/logic change.

## Technical

- **`src/views/Today.jsx`** — the two adjacent `<List>` blocks (completed-today with
  its `Completed today` `SectionHeader`, then the recent peek) are now **one `<List>`**:
  completed-today rows first, then recent rows, then the `History ›` link row.
  - The seam was structural: each `.ui-list` carries `margin: var(--ui-s3) 0` and a
    `border-top`, and each row a `border-bottom` — so completed-list-bottom ↔
    recent-list-top stacked a doubled hairline + doubled margin = the thin white gap.
    One list = one top rule, one set of margins, no seam. No CSS change was needed.
  - **State is now per-row, not per-section:** a completed-today row's date is today, so
    `WorkoutInfo` gets `today={true}` → `.ui-workout-info--today` renders its body
    near-black (`--ui-ink`); recent prior-day rows render gray (`--ui-ink-2`). That
    black-vs-gray is what keeps the two states legible in the single list.
  - Removed the now-unused `SectionHeader` import (lint would flag it).
- **De-dup preserved:** the `recent` selector (unchanged, ~242) already excludes
  today's finished sessions by id (`completedTodayIds`), so a completed-today session
  never also appears as a recent row.
- **Empty states:** the `No history yet.` line still shows only when both are empty; the
  single `<List>` always renders the `History ›` link at the bottom (as the old recent
  list did). Completed-only, recent-only, and both-empty all render one clean list with
  no orphaned header or dangling rule.
- Stale/unfinished workouts (req-55) still route through `InProgressPeekRow` in the same
  merged map — unchanged.

## Verified

- `./check` green — lint, 261 tests, build all passed.
- Structure reduces to a single list; de-dup logic untouched.

## Could not verify from here (browser — for Emilio)

- That the white gap is gone and it reads as one continuous list on Today with both a
  completed-today session and recent history.
- That completed (black) vs recent (gray) rows are distinguishable enough without the
  old section header.
- The three empty-state renders on a real screen.

## Workflow

- **Decision to surface (visible change):** I **dropped the "Completed today" section
  header** rather than keeping it above the merged list. Emilio's note asked for "a
  list — with different states in the list"; a header labelling a list whose lower rows
  are prior-day history would contradict itself, so the state moved onto the rows
  (near-black today vs gray prior). The spec allowed "a single lightweight label/heading
  … if it still reads as one continuous list" — so a header is sanctioned if he wants
  the callout back; it's a one-line add. Flagging because it changes what he sees.
- No other scope change. `completedToday` / `recent` computation and row link targets
  are untouched, per out-of-scope.
