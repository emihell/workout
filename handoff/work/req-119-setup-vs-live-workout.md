# req-119 — setup edits never reach into the live workout (audit B)

**Status: BUILT AND MERGED, 2026-09-23 — branch `req-119` (`cbdec8b`…`cbdec8b`, 1 commit).** Phase 1. **[P]**: store delete paths, and a new optional
snapshot field (DEC-057: reviewer + backup reminder).

## Why [measured, scratchpad/audit-setup]

1. `removeExercise` / `removeRoutine` (`store.jsx:191-200`, `:44-66`) count only **finished** workouts as
   references. Deleting an exercise or routine that the **active** workout uses hard-deletes it. The confirm says
   nothing about the live workout. After Finish, history shows the raw id (`history/list.jsx:128`) and the
   workout's `routineId` points at nothing. Today (`Today.jsx:268`, `!routines.length`) shows the first-run "No
   data" screen mid-workout (no Continue) and after Finish, with history present.
2. `liveExercise` (`item.jsx:35-44`) prefers `store.exercises` over the snapshot, and `hasDuration` is only read
   live (`:295`). Switching Bench to bodyweight + Timed in the Library mid-workout turned set 2/3 into a 30 s
   countdown with no kg, while `snapshot.exerciseType` still said "free" (DESIGN §3: the live workout is a
   snapshot).

## The behaviour

1. **The active workout counts as a reference** (DEC-058 §5, amending DEC-031): its snapshot items and sets.
   Deleting a referenced exercise or routine archives it, and the confirm says it's in the current workout.
2. **Today's first-run empty state** requires no routines **and** no workouts **and** no active workout.
3. **The live set form reads type and Timed from the snapshot.** Snapshot items gain `hasDuration` when they're
   built: in `buildPlannedWorkout` (`planSnapshot` has no access to exercises, `model.js:478-485`) **and** in
   `replacementItem` (req-109). Missing → read the live exercise, the old behaviour. `completeSet`'s `ex.type`
   (`item.jsx:210`) reads the snapshot too. Only weight step and cues, edited from inside the workout
   (`workout/setup.jsx`), apply live. **(unconfirmed)** Name, equipment and durationSec also come from the snapshot
   mid-workout.

## Scope

`store.jsx` (remove paths + confirm-impact helpers, as pure `.js` helpers for the tests), `Today.jsx`, `item.jsx`,
`model.js` (`buildPlannedWorkout`), `workout-log.js` (`replacementItem`), tests.

## Order vs siblings

**Last** of Tier 1: after req-116 and req-117 (`item.jsx`) and req-120 (`model.js`).

## Acceptance criteria

- **Delete during a workout (unit):** exercise X in the active workout only → `removeExercise` archives it; after
  Finish, history shows its name.
- **Routine (unit + browser):** delete the active workout's routine → archived; Today still shows Continue; after
  Finish, History lists it by name.
- **Failure case — Library edit (browser/unit):** mid-workout, set the exercise to Timed + bodyweight → the current
  set form is unchanged (kg shown, no countdown).
- **Old active workout (unit):** a snapshot item without `hasDuration` → falls back to the live exercise (unchanged).
- **Replacement (unit):** a req-109 replacement item carries `hasDuration` from its exercise.
- **No regression:** `./check` green. Receipt quoted.

## Decisions

- Archive-on-live-reference (Emilio, DEC-058 §5, amends DEC-031).
- Snapshot type/Timed (DESIGN §3); name/equipment/duration from the snapshot too **(unconfirmed)**.
