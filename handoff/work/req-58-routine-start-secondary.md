# req-58 — Routine-row Start is secondary, not primary (off-schedule is unusual)

**Status: READY.** From Emilio 2026-09-13: *"start in routines can also be secondary —
it's unusual to start from here — it's when you didn't follow the schedule."* Tweak to
req-56.

**Gate: ux-feel.** One line in a single view. Planning builds + tests + merges on its
own testing.

## Why

req-56 gave each routine row an **Edit** (secondary link) + **Start**
(`<Button variant="primary">`, `Routine.jsx` `Routines()`). Emilio: starting a workout
from the Routines page is the *off-schedule* fallback, not the common path (the common
start is today's hero on the Workout page), so its Start shouldn't carry the primary
ink emphasis.

## The behaviour (decided)

Change the routine row's **Start** from `variant="primary"` to `variant="secondary"`.
Keep DESIGN §4 placement (Start still on the right, Edit on the left) — only the weight
drops, so nothing on the row shouts.

## Scope

- `Routine.jsx` `Routines()`: the Start `<Button>` variant `primary` → `secondary`.

## Out of scope

- Edit (already secondary); the row layout/order; anything else.
- The Start on the today hero (`TodayHero`/`TodayWorkout`) — that IS the common path;
  stays primary.

## Acceptance criteria

- **Start is secondary:** the routine row's Start renders `ui-btn--secondary` (not
  `--primary`) — confirm in the diff; nothing on the row is ink-primary.
- **Still starts:** tapping it still calls `startOrContinue(store, routine.id)`
  (unchanged behaviour, incl. the req-55 abandon-on-new warning when one's in progress).
- **No regression:** `./check` green — paste the line.

## Decisions

- **behaviour (Emilio):** routine-row Start is secondary.
- **implementation (CC's call):** none beyond the variant change.
