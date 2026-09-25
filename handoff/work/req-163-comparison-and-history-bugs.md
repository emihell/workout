# req-163 — "last time" comparisons and History set bugs (audit + BACKLOG follow-ups)

**Status: READY** (2026-09-25) — **Lane: bug.** DEC-087. Reviewer fires (storage.js / workout-log.js). Build on `main` ≥
`ba7d1b2`. Rescan each site first; the refs below are from `main` 2026-09-25.

1. **F-CODE-3 — "the previous workout" is chosen two ways.** `previousSameRoutineWorkouts` (`storage.js:699`; comment
   `:682,:696` "workouts is newest-first") feeds Finish's beat-last-time (`finish.jsx`) and auto-complete's deltas; it
   trusts array order. `lastSetsForExercise` (`storage.js:561`) sorts by `finishedAt`. After an import that isn't
   newest-first (Emilio will reimport his Export) Finish compares against the **oldest** workout. **Fix:** one ordering —
   by `finishedAt` (then a stable tie-break) — in both; no reliance on array order anywhere "previous/last" is chosen
   (grep for others).
2. **req-109 b — after Replace exercise, "last time" reads rest 0.** `historyPrescription` (`storage.js:600`) and
   beat-last-time take the FIRST snapshot item of an exercise, so after a replacement they read the replacement's rest 0.
   **Fix:** pick the item that actually has the exercise's logged sets (or the non-replacement one); a test with a
   replaced item.
3. **req-111 a — auto-complete compares against an all-skipped prior.** `workoutSummaryStats` (`storage.js:661`) "vs last
   time" volume uses a prior same-routine workout where everything was skipped. **Fix:** skip priors with no done working
   set (same rule as DEC-053).
4. **req-111 b — warm-up-only history gets no work prefill and no kg carry.** An exercise whose history has only warm-up
   sets: the work set gets neither a history prefill nor the DEC-002 carry. Per DEC-053's clarification, warm-up-only
   counts as no work history → the DEC-002 carry applies. (req-158's reviewer noted main already carries in one path —
   confirm and make all paths agree.)
5. **req-117 b — History Add/Edit set can't record a duration for a timed exercise.** Add a Duration field to History's
   set form for a timed exercise (same parse as req-155's `seconds-input.js`), saving `durationSec`.
6. **DEC-087 §2 — Effort display in History:** (a) an **old** warm-up/cardio set stored with `rpe: 3` from before req-156
   shows no effort label in History (display only — the stored value is not rewritten); (b) History's set edit hides
   Effort for a warm-up/cardio set and saves `rpe: null` for it (like the live forms).

## Out of scope

Rewriting stored data (none). The dead first Back (DEC-084). New features (req-10 etc.).

## Acceptance criteria

- Each item: a test that **fails on main** and passes on the branch (paste both).
- (1): an oldest-first `workouts` array → Finish's comparison and the prefill pick the same (newest) workout.
- (6a): a stored WU set with `rpe: 3` renders no "Moderate" in History; its stored `rpe` is still 3 (no write).
- Browser via `./plan qa req-163` + the smoke: at least items 1, 2, 5, 6 with stored/DOM values pasted.
- `./check --smoke` green (paste). Reviewer before merge.
