**Status: READY** · **Lane: ui** · batch 7 (J3, J6). Adds one optional field on an exercise, written only by the user's own
edit; no migration, no bulk write.

# req-240 — "each side" for timed sets, and a "One side at a time" switch for your own exercises

Emilio, 2026-10-16 (Side Plank, review): "Should be one on each side." 2026-10-19 (Kettlebell Lunge Press, log): "Is this ex
two on each side for each set?" No E decision against (PAGES.md: DEC-119 §6, DEC-122 §2 say one-sided work is stated
plainly) → Planner's fix (DEC-137).

## Code facts (rescanned 2026-10-26, `main` 103678a; exercises read-only from Emilio's server data, rev 4)

- One-sided comes **only** from the library: `isEachSide` = `libraryEntryFor(exercise, library)?.unilateral === true`
  (`library-hints.js:11-13`). Side Plank → `Side_Bridge`, unilateral `true` (`library/common.js:161`).
- Display: reps get "12 each side" (`eachSideReps`, `workout-log.js:1078-1081`); seconds don't —
  `setPreviewText` shows `${durationSec}s` unchanged (`workout-log.js:1008-1012`); the form label is "Duration" for timed
  (`views/workout/item.jsx:492`, `:813`). The head line `ONE_SIDE_LINE` = "One side at a time — all reps on one side, then
  the other." (`library-hints.js:17`) — wrong for a hold.
- Kettlebell Lunge Press: own exercise, `libraryId: null`, no `unilateral` → never "each side". The exercise form has no such
  setting (`views/Exercises.jsx:409-480`; saves through `store.updateExercise` → `patchExercise`, `state-reducers.js:372`).
  `migrateState` spreads each exercise (`model.js:363-370`), so an extra optional field survives load [inferred — the
  build adds a test].

## Scope

1. **Timed one-sided sets:** seconds read "30s each side" in the set list, preview and review lines; the form label reads
   "Duration each side"; `ONE_SIDE_LINE` gets a timed version: "One side at a time — the full time on one side, then the
   other."
2. **Own setting:** exercise Details gets a checkbox **"One side at a time"** (all types except cardio). Saved as
   `exercise.unilateral: true | false`; untouched → field left absent.
3. `isEachSide`: the exercise's own `unilateral` boolean wins when present; absent → the library entry, as today (DEC-063 §3:
   your edit wins, untouched follows the library). The checkbox starts from that resolved value.
4. The workout reads it live (as today's library lookup does); nothing new is frozen in the snapshot.

## Out of scope

- History screens (they don't show "each side" today); the library data; one-arm kg wording (`kg-label.js`).

## Acceptance criteria

1. Side Plank (library, timed): set list, review lines and form label read "30s each side" / "Duration each side"; the head
   line is the timed version.
2. An own exercise with the box ticked → "8 each side" on the log screen and review; stored exercise has `unilateral: true`.
3. **Failure / right mechanism:** a library-unilateral exercise with `unilateral: false` stored → no "each side" anywhere
   (own value beats library); an exercise never edited (field absent) → behaves exactly as `main` (req-217/219 tests pass
   unchanged).
4. A state with `unilateral` on an exercise survives `migrateState` and Export → Import (round-trip test).
5. `./check` green.

## Decisions made on Emilio's behalf

- Wording "30s each side", "Duration each side", the timed head line, and "One side at a time" as the checkbox label
  `(unconfirmed)` — behaviour (copy).
- Field name `unilateral` (mirrors the library) — implementation.

## READY checks

1 DECs: DEC-063 §3, DEC-119 §6, DEC-122 §2. 2 Siblings: req-239/241 touch `item.jsx` (order 239 → 240 → 241).
3 No deferral. 4 Side_Bridge flag measured (`common.js:161`). 5 Trigger files: `workout-log.js` (display helpers) →
**independent reviewer**; no stored records written by the app → no backup reminder. 6 Unconfirmed marked.
