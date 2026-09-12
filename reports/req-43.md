# req-43 — the delete confirm names what it will remove (audit F-DIV-3, DEC-031)

Branch `req-43`. Gate: functional (user-facing wording + pure helpers). No
store-logic or data change.

## Technical

**What changed**

- `src/storage.js` — two pure helpers beside `routinesUsingExercise`:
  - `routineDeletionImpact(state, routineId)` → `{ slots, plans, hasHistory }`.
    `slots`/`plans` count schedule slots and planned workouts referencing the
    routine; `hasHistory` = any finished workout references it. All three use the
    store's own reference test `(obj.routineId || obj.sessionId) === routineId`,
    so the counts match exactly what `removeRoutine` drops.
  - `exerciseDeletionImpact(state, exerciseId)` → `{ routines, hasHistory }`.
    Reuses `routinesUsingExercise` for the routine count; `hasHistory` mirrors the
    store's `set.exerciseId` history test.
- `src/views/Routine.jsx:152` and `src/views/Exercises.jsx:319` — the bare
  `window.confirm(\`Delete ${name}?\`)` now composes archive-vs-delete wording +
  the counts (only when > 0), built from the helpers. Still one native
  `window.confirm` each (inline UI is req-24, out of scope). Both pass `store`
  (which is `{ ...state, ...methods }`, so it carries `schedule`/`plannedWorkouts`/
  `workouts`) as the `state` arg.

**Composed confirm strings** (verified by reading the composing code):

Routine (`Routine.jsx`):
- history + 2 slots + 1 plan:
  `"Upper Body has past workouts and will be archived (kept in your history). This removes 2 schedule slots and 1 planned workout."`
- no history + 2 slots:
  `"Delete Upper Body? This removes 2 schedule slots."`
- no history, no references:
  `"Delete Upper Body?"`
- Singular/plural handled: `1 schedule slot` / `2 schedule slots`.

Exercise (`Exercises.jsx`):
- history + in 3 routines:
  `"Bench Press has past workouts and will be archived (kept in your history). This removes it from 3 routines (and any planned workouts)."`
- no history + in 1 routine:
  `"Delete Bench Press? This removes it from 1 routine (and any planned workouts)."`
- no history, unused: `"Delete Bench Press?"`

**Choices left open by the spec (mine)**

- Wording: "has past workouts and will be archived (kept in your history)." — I
  added the parenthetical "(kept in your history)" so archive reads as reassurance,
  not loss. Spec's example was close; Emilio can tweak at a glance.
- Routine counts joined with " and " ("2 schedule slots and 1 planned workout");
  exercise uses "removes it from N routine(s) (and any planned workouts)" per spec.

**Verification**

`store.jsx` is **not in the diff** — `removeRoutine`/`removeExercise` logic
byte-unchanged (acceptance criterion):

```
$ git diff --stat
 src/storage.js          | 29 ++++++
 src/storage.test.js     | 70 ++++++-
 src/views/Exercises.jsx | 13 ++-
 src/views/Routine.jsx   | 16 ++-
```

New impact tests (`storage.test.js`) — all pass:

```
ok 1 - routineDeletionImpact counts slots + plans and flags no history
ok 2 - routineDeletionImpact flags history via routineId || sessionId
ok 3 - a routine with no references at all is all-zero, no history
ok 4 - exerciseDeletionImpact counts routines and flags history
ok 5 - exerciseDeletionImpact: an exercise used in a routine but never logged
```

They cover: slot count via both `routineId` and legacy `sessionId`; plan count;
`hasHistory` true/false via `routineId || sessionId`; all-zero for an unreferenced
routine; exercise routine count via `routinesUsingExercise`; exercise history via a
set's `exerciseId`; and an exercise in a routine but never logged (`hasHistory:false`).

`./check` green:

```
check: green — lint, 15 test file(s), and the build all passed.
```

## Workflow

- No scope deviation. Two pure helpers + the two enriched confirms + tests, exactly
  as specified. Did not touch `removeRoutine`/`removeExercise`, `validWeights`, or
  the relationship-page "Remove" confirm (`Routine.jsx`).
- One self-caught test bug mid-build: I first asserted a routine referenced only by
  a workout's legacy `sessionId` had `hasHistory:false`; that's wrong — the helper
  intentionally counts `routineId || sessionId`, so it's `true`. Fixed the
  assertion (the helper was correct). Worth noting only as a receipt that the
  legacy-field path is exercised.
- No `DEC-`/`L-` candidates.

## What I could not verify (functional gate — eyeball welcome)

The confirm text can't be read by a unit test (native `window.confirm` in JSX).
The composed strings are quoted above from the composing code. An in-app eyeball
worth a moment: delete a routine that has schedule slots (see the counts), and one
with past workouts (see "will be archived"); same for an exercise used in routines.
