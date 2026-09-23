# req-111 — "last time" looks past a workout where that exercise was entirely skipped (DEC-053)

**Status: SPEC — READY, held for Emilio's go.** Phase 1. **[functional]** Found by the batch-4 external
review (2026-09-23); fix chosen by Emilio the same day. Built **before req-109** (skip/swap makes an
all-skipped exercise the normal case).

## Why

[measured]
- `lastSetsForExercise` (`src/storage.js:348`) returns the most recent finished workout with **any** set of
  the exercise, skipped ones included. If that workout's sets are all skipped, `historySetPrefill`
  (`:360`) finds no working set, so every set prefills **no kg**. `hasHistory` is true, so the DEC-002
  carry doesn't kick in either. The review's probe: `last workout picked: w1 prefill set0: {"weight":"","reps":""}`.
- `workSetsFor` (`src/beat-last-time.js:25`) keeps skipped sets (weight 0, reps `'skipped'`), so the
  exercise after a skipped week reports a false **"heavier"** win (probe: bench 40 kg vs a prior all-skipped → `[{"kind":"heavier"}]`).
- This exists today when Finish auto-skips unlogged sets (`withSkippedUnloggedSets`, `workout-log.js:75`).

## The behaviour

1. **Prefill.** For an exercise, "last time" = the most recent finished workout with at least one
   **non-skipped** set of it. A workout where it was entirely skipped is passed over. None → no history
   (so DEC-002's kg carry applies, as for a new exercise).
2. **Everything built on `lastSetsForExercise` follows:** the log-screen prefill (`item.jsx:149`) and
   `historyPrescription` (`storage.js:375`, used when adding the exercise in the routine editor,
   `Routine.jsx:381`).
3. **Beat last time.** Skipped sets never count on either side. Per exercise, the comparison uses the most
   recent **previous same-routine** finished workout where that exercise has non-skipped work sets (it looks
   past all-skipped ones). None → silent, as today (DEC-050's no-invent rule).
4. An exercise skipped entirely **this** workout gets no win line.

## Scope

`src/storage.js` (`lastSetsForExercise`), `src/beat-last-time.js` (+ how `finish.jsx:40` /
`auto-complete.jsx:36` pass the prior), tests.

## Out of scope

History list/detail display of skipped sets (unchanged); the auto-complete "vs last time" volume
(`workoutSummaryStats`); the routine template.

## Order vs siblings

After req-104 (which removes the done view's other `lastSetsForExercise` use, `item.jsx:382`). Before req-109.

## Acceptance criteria

- **Looks past (unit):** workouts newest-first: w2 bench all skipped, w1 bench 40×8 → `lastSetsForExercise`
  returns w1, and the set-1 prefill is `40` kg.
- **Failure case — only skipped history (unit):** bench's only history is all-skipped → returns `null`
  (no history), not the skipped workout.
- **Partial skip is still history (unit):** w2 bench 1 done + 2 skipped → w2 is last time; its done set is
  set 1's prefill.
- **No false win (unit):** current bench 40 kg, previous same-routine workout bench all skipped, the one
  before bench 40 kg → no win. Same current vs a 35 kg one before → `heavier`.
- **Skipped this time (unit):** current bench all skipped, prior bench 40 → no bench win.
- **No regression:** `./check` green; existing prefill and beat-last-time tests pass unmodified (any
  changed test is named and justified in the diff).

## Decisions

- Look past an all-skipped workout for prefill and beat-last-time (Emilio, 2026-09-23) → DEC-053.
- How the prior list reaches `beatLastTimeWins` (signature) — implementation (CC).
