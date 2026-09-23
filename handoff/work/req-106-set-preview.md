# req-106 — at the start of an exercise, a small preview of all its sets and weights (batch 4, F4)

**Status: BUILT AND MERGED, 2026-09-23 — branch `req-106` (`44ee951`…`44ee951`, 1 commit).** Phase 1. **[ux-feel]**

From Emilio's in-app note (2026-09-18, `/workout/…/item/…overhead-db-press/log`): *"In the start of a
exercise, at the bottom, show preview of the other sets and their weight, small little text, this is
just so in the start you can grab all weights for the exercise and see the sets"*

## Why

[measured] The log screen (`WorkoutItemLive`, `src/views/workout/item.jsx`) computes the seed only for
the **current** set (`initialSetFields` → `setLogSeed`, `src/workout-log.js`). Nothing shows the sets
still to come, so you can't pick up every dumbbell at once.

## The behaviour

- **When:** shown while **no set of this exercise has been logged yet** ("in the start"). Once the first
  set is completed or skipped it goes away.
- **Where / how:** at the bottom of the log screen, small muted text, one line per set of the exercise
  (the warm-up set first when there is one): e.g. `WU · 10 kg × 10`, `1 · 20 kg × 8`, `2 · 22 kg × 8`.
  Timed work sets show their duration instead of reps.
- **Values — DESIGN §1, the core of this req:** each line shows **exactly what that set's log form would
  prefill** if you reached it now — the same `initialSetFields` sources (history for that set index /
  target reps), per set. **A set with no history shows no kg** (e.g. `2 · — × 8`), never a guessed or
  copied weight. Compute it in a pure, tested helper beside `initialSetFields`, not in the view.
- **Duration:** the timed-set duration rule is view code today (`item.jsx:263-268`: `item.durations[i] ??
  last ?? ex.durationSec ?? DEFAULT_DURATION_SEC`). Move it into a pure helper shared by the form and the
  preview, so the two can't drift.
- At the start nothing is logged, so restore and carry are null; the only other input is a weight override
  from an **earlier item of the same exercise** this session (`seedOverrides` is keyed `exerciseId::setType`,
  `workout-log.js:213`) — the preview shows it, exactly as the form would.
- Read-only: tapping a line does nothing.

## Scope

`src/views/workout/item.jsx`; a pure helper + tests in `src/workout-log.js` / `workout-log.test.js`;
`src/ui/ui.css`.

## Out of scope

Editing weights from the preview; showing it after the first set (reversible later if Emilio wants it
always visible); the done view.

## Order vs siblings

Build after req-104 (same file) and **before req-108**. req-108 changes what reps seed; the preview must
keep matching the form, so req-108's acceptance re-checks it.

## Acceptance criteria

- **Shows at start (browser):** open an exercise with 1 WU + 3 work sets and finished history → 4 lines
  with the WU/work weights and reps from that history.
- **Gone after a set (browser):** complete or skip the first set → the preview is gone.
- **Failure case — no history (unit):** a weighted exercise with no finished history → every line has no
  kg; reps come from the targets.
- **Right mechanism (unit):** for each set index the helper returns the same weight/reps that
  `initialSetFields` returns for that set — assert against `initialSetFields`.
- **Fixed numbers (unit):** history WU 10×10, work 20×8 / 22×8 / 24×6 → exactly `WU · 10 kg × 10`,
  `1 · 20 kg × 8`, `2 · 22 kg × 8`, `3 · 24 kg × 6` (guards against the helper and the test sharing a bug).
- **Bodyweight / timed:** a bodyweight exercise shows reps only; a timed exercise's work sets show a
  duration.
- **No regression:** `./check` green.

## Decisions

- Shown only before the first set (Emilio, 2026-09-23). Reversible.
- The line format and styling — implementation (CC), within "small little text".
