# req-112 — Finish no longer rewrites the routine; recalc maths goes per set (DEC-056)

**Status: SPEC — READY, held for Emilio's go.** Phase 1. **[functional]** Touches the finish write path
(`store.jsx`) and `progress.js`. No schema bump and no stored-data rewrite: it **stops** a write, it doesn't
add one.

Emilio, 2026-09-23: *"maybe we should not auto update? update should maybe be a clean choice? something to
do after you finish a loop?"*

## Why

[measured, scratch script against the real `progressionForItem` + `applyProgressionToRoutines`. Routine:
2 sets, targets 10/8, weights 30/35]

| Logged | Routine after Finish |
| --- | --- |
| set 1 skipped, set 2 35×8 (hit its target) | weights `[32.5]` |
| set 1 30×10, set 2 skipped | `[30]` (set 2's weight lost) |
| bodyweight, set 1 skipped, set 2 8 (target 10) | set **1's** target 15→14 |

Cause: `recommendNextPrescription` (`src/progress.js:67`) iterates only the non-skipped sets
(`progressionForItem`, `src/model.js:357`), so `targets[index]` and `weights[index]` use the position among
**logged** sets, not the set's own index. And every Finish writes the result onto the routine
(`store.jsx` `finishWorkout` → `applyProgressionToRoutines`) with no choice offered, which DESIGN §2 says
shouldn't happen.

## The behaviour

1. **Finish (manual and auto-complete) no longer changes the routine.** The finished workout still stores
   its `progression` record as today (it's history, and recalc reads it). `plannedWorkouts` cleanup etc. is
   unchanged.
2. **Recalc stays**, and stays explicit: correct a workout in History → preview → Apply / Skip
   (`recalc.jsx`, `store.recalculateFuturePlans`).
3. **The recommendation maths goes per set.** Each logged working set is judged against **its own** set
   index's target. A **skipped** set (or one not logged) keeps the routine's existing weight and target for
   that index. The result has one weight per routine set, and never shrinks the arrays.

## Scope

`src/store.jsx` (`finishWorkout`), `src/progress.js` (`recommendNextPrescription`), `src/model.js`
(`progressionForItem`, keeping each set's work index), tests.

## Out of scope

The Phase 2 "review and update the routine" step (DEC-056, later); removing recalc; the Finish screen's UI;
`workout.progression`'s stored shape.

## Watch-outs (CC)

- Name every caller of `progressionForItem` / `recommendNextPrescription` / `applyProgressionToRoutines`
  (finish, auto-complete, recalc, `progressionFromWorkout`, beat-last-time?) and state what each does now.
- Tests asserting that Finish updates the routine are **changed by this req** (a decision reversal,
  DEC-056). Name them. Don't delete coverage; assert the routine is **unchanged** instead.
- A workout's stored `progression` from before this change is read as before. No migration.

## Acceptance criteria

- **Finish leaves the routine alone (unit, store-level):** finish a workout whose sets differ from the
  routine → `routines` deep-equal to before. The same holds through the auto-complete path.
- **Progression still recorded (unit):** the finished workout carries `progression` as before.
- **Per-set maths (unit):** the three table rows above → (a) `[30, 35]` with set 2 judged against target 8
  (held); (b) `[30, 35]` (set 2 kept); (c) bodyweight targets `['15','9']`, meaning set 2 missed and stepped
  down, and set 1 is untouched.
- **Failure case — all skipped (unit):** the routine's weights and targets are unchanged by recalc.
- **Recalc still applies (unit):** correct a workout, then `recalculateFuturePlans` → the routine gets the
  per-set result.
- **No regression:** `./check` green; no `STORAGE_KEY` / schema change.

## Decisions

- No automatic routine update at Finish; recalc stays explicit (Emilio, 2026-09-23) → DEC-056.
- Per-set indexing, and skipped sets keeping the routine value. Planner's call: this is the bug fix that
  makes recalc's numbers right.
