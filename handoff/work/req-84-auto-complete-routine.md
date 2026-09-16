# req-84 — auto-complete a finished routine (N10, gym-flow batch 2)

**Status: READY — decisions + full spec settled with Emilio 2026-09-16.** No persisted-data change
(read-only stats + the existing finish path). From Emilio's 2026-09-14 notes:
*"When all exercises in a routine are done, auto-complete? A 'great job' in 10 sec showing
stats/improvements from last time, then auto-complete the whole routine but with an option to
edit … goal should be that everything is automated and user interaction is minimal — instead of
a list all done and press Done."*

**Gate: gym-flow feel (ux-feel) + behaviour (it writes a finish).**

## Why

[measured] when every exercise is done, the user still taps **Finish** (`overview.jsx:116`) →
`WorkoutFinish`. Emilio wants the finish to feel automatic: a short celebratory summary, then the
workout completes on its own with a chance to intervene.

## The behaviour (decided, Emilio 2026-09-16)

When **every exercise in the active workout is done**, auto-show a "great job" summary instead of
leaving the user to tap Finish off a list:

- **Trigger:** all items done — `items.every(i => itemIsMarkedDone(active, i) || itemLoggingState(active,
  i).plannedDone)` (net-new but trivial; reuses the same pure helpers the overview already runs per-item,
  `overview.jsx:105`). Fires when the last set completes and the app returns to the overview
  (`item.jsx:158-160` already makes that the transition point). It must NOT fire before everything is done.
- **The summary** shows the workout's stats **and a "vs last time" comparison** (below), then a **~10s
  countdown** that **auto-commits the finish on expiry**. A visible **Cancel/Edit** stops the countdown:
  Cancel returns to the overview (nothing finished); Edit opens the existing Finish screen
  (`finish.jsx`) so Feel/Note/progression can be set/reviewed.
- **Auto-commit** calls the existing `store.finishWorkout({ overallNote: '', overallFeel: '', progression })`
  (`store.jsx:353`) with empty Feel/Note and the same `progressionForItem`-derived progression the Finish
  screen computes today (`finish.jsx:29-48`). Feel/Note are only set if the user takes the Edit path.

### The "vs last time" stats (net-new — nothing compares two workouts today)

Show three per-workout numbers, each with a delta vs **the previous finished workout of the SAME
routine**:
- **Volume** — `workoutVolume` (Σ weight×reps over working sets; `storage.js:393`).
- **Duration** — minutes (as `finish.jsx:26` / `durationLabel`).
- **Set count** — `sets.length`.

"Previous same-routine workout" = the most recent finished workout in this workout's routine group
(`groupWorkoutsByRoutine`, `storage.js:234`), i.e. index 0 of that group **at summary time** (the
just-finished workout is still `activeWorkout`, not yet in `store.workouts`). If there is **no** prior
same-routine workout (first time), show the stats with **no delta** — never invent a comparison
(DESIGN §1). Keep the comparison a pure, testable helper (inputs → {volume, duration, sets, deltas|null}),
inspectable like the other computed values.

### Countdown / cue

A **new, UI-only** countdown (a ~10s deadline timestamp + a 250ms `setInterval`, the pattern from
`useRestCountdown`, `rest.jsx:10`) — **not** the persisted `restEndsAt` (that has pause/skip semantics
and one instance already in use). Reuse `defaultBeep`/the edge-fire logic from `rest-cue.js` for an
optional cue at commit; the AudioContext is already unlocked on set-complete taps.

## Data-trust note

Auto-writing a finish is an automatic persist — it **must be cancellable before it commits** (the
Cancel/Edit escape), and the summary **invents nothing**: every stat comes from the logged sets and a
real prior finished workout (no prior → no delta).

## Scope

- The all-done detection + the summary/countdown UI (a new component on/above the overview, or a
  route — CC picks; the overview at `overview.jsx` is the trigger point).
- The pure "vs last time" stats helper (volume/duration/sets + deltas vs prior same-routine workout).
- Auto-commit via the **existing** `store.finishWorkout` — no new store mutation, no data change.

## Out of scope

- Any change to `finishWorkout`'s persisted shape or to stored records.
- The manual Finish screen stays (it's the Edit path); progression logic unchanged.
- Per-exercise "beat your top set" / PR detection (not in v1 — volume/duration/sets only).
- Duration progression, timed exercises (req-85).

## Acceptance criteria

- **Summary on all-done (browser):** completing the last set → the "great job" summary appears with
  volume/duration/sets and, when a prior same-routine workout exists, a delta for each — all from real
  logged data.
- **First-time (failure case — no-invent):** a routine with no prior finished workout → the summary
  shows the stats with **no delta**, never a fabricated comparison.
- **Auto-commit:** left alone, the ~10s countdown expires → the workout finishes (lands in history,
  `activeWorkout` cleared) with empty Feel/Note.
- **Escape hatch (failure case):** Cancel before expiry → back to the overview, **nothing finished**
  (no premature persist); Edit → the existing Finish screen, where Feel/Note/progression can be set.
- **Not premature:** the summary does not appear while any exercise is still not-done.
- **No regression:** `./check` green; the pure stats helper is unit-tested (incl. the no-prior case).

## Decisions

- Countdown-then-confirm, auto-commit on expiry (Emilio, 2026-09-16).
- Stats = volume + duration + set count vs the previous **same-routine** finished workout; no per-set/PR
  comparison in v1 (Emilio, 2026-09-16).
- Auto-commit uses empty Feel/Note; Edit is the path to set them (Emilio, 2026-09-16).
- Countdown = new UI-only timer, not the persisted `restEndsAt` — implementation (Planner/CC).
