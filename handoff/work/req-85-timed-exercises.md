# req-85 — timed exercises (duration sets) (N2 / batch-1 #6, gym-flow)

**Status: BUILT AND MERGED, 2026-09-16 — branch `req-85` (`0e5ae4b`…`0e5ae4b`, 1 commit).**
Emilio 2026-09-14: *"Time for timed exercises."* Same feature as the 2026-09-10 note #6; unparked and
specced 2026-09-16. **Merge gate remains:** this is a real schema-version bump, so it fires CLAUDE.md
ask-gate #2 / DEC-035's migration carve-out — **Emilio's eyes on the migration test + a fresh Export
backup (DEC-046) before Planner merges.** Build it on its own, not folded into a light batch.

**Gate: persisted-data + model + UI** (schema-version bump).

## Why

An exercise should be able to carry a **weight and/or a timer**. A timed exercise (e.g. plank)
shows a count-**down** during the set that you start, with a sound at zero. [measured] exercises
have `restSec` already (`model.js:41`) but **no per-set work duration**; `EXERCISE_TYPES =
['machine','free','bodyweight','cardio']` (`ids.js:51`) has no "timed" concept. Rowing already
uses a "Duration" field (cardio) — a duration concept **partly exists** and may inform the shape.

## Model decided (Emilio, 2026-09-16): (a) orthogonal weight/duration flag

Any exercise can carry a **weight and/or a duration** — a flag on the exercise, **not** a new type,
so an exercise can be weighted, timed, or both (matches Emilio's framing; Rowing's existing "Duration"
shows a duration concept can coexist with type). (b) new `'timed'` `EXERCISE_TYPES` value **rejected**
(rigid: timed OR weighted, never both).

## The behaviour (decided, Emilio 2026-09-16)

- An exercise carries a **`hasDuration`** flag (orthogonal to weight/type). Set in the exercise editor,
  with a **default target duration** (seconds).
- A **timed set logs a duration in place of reps** (weight stays orthogonal): plank = duration only;
  weighted carry = weight + duration; a normal lift = weight + reps, unchanged. `reps` is untouched for
  non-timed exercises. (Note today's cardio "Duration" is only the *reps field relabeled* — free text,
  `progress.js:43`; the new duration is a **separate numeric seconds field**, NOT that.)
- **In-set countdown:** for a timed set the form shows a **Start** button → a **count-down from the
  target duration** → a **beep at zero** (reuse `defaultBeep`/edge-fire from `rest-cue.js`; the
  AudioContext is already unlocked on the set tap). You then **Complete** — you may complete early or
  hold past zero. The set logs the **target** duration (editable), not a stopwatch actual, for v1.
- It is a **second, concurrent countdown**, with **its own state** — it must NOT reuse the persisted
  `restEndsAt` (one instance, pause/skip semantics, drives the rest pill/cue) or it will collide.
- **No duration progression in v1:** weight still progresses for a weighted+timed exercise
  (`progress.js` weight branch is unaffected); the duration stays static. A duration-only exercise
  flows harmlessly through the existing `bodyweight || weight<=0` branch (`progress.js:75`, action
  'keep'). Increasing the target next time is **future**, explicitly out of scope here.

## The schema bump — exactly what changes (Emilio signed off 2026-09-16)

**`SCHEMA_VERSION 8 → 9`** (`model.js:5`); **`STORAGE_KEY → 'workout-mvp-v9'`**, prepend `'workout-mvp-v8'`
to `LEGACY_KEYS` (`storage.js:5-6`). Two new optional fields:
- **Exercise record:** `+ hasDuration` (boolean, default **false**) and a default `durationSec`
  (number) — added in `addExercise`/`updateExercise` (`store.jsx:166`) and defaulted in the exercise
  map inside `migrateState` (`model.js:230`).
- **Routine item:** `+ durations: []` — a **per-set** seconds array, parallel to the existing
  `targets`/`suggestedWeights` arrays (`store.jsx:73-83`, defaulted in `migrateRoutine`, `model.js:39-49`).
- **Threading (the schema-bump hazard):** `buildPlannedWorkout` (`model.js:350-376`) must copy the new
  item field into the plan item, and the legacy-rebuild branch of `workoutSnapshot` (`model.js:156-171`)
  must include it (the already-snapshotted branch spreads `...rest`, so finished history is preserved).
  `planSnapshot` `structuredClone`s, so it needs no change.

**What changes and to how many records:** the migration is a single **idempotent, shape-driven**
transform (not a step chain — `migrateState`, `model.js:221-275`). On first load after the upgrade,
**every existing exercise and every routine item gets the new fields at their defaults** (`hasDuration:
false`, `durations: []`) — i.e. every stored exercise/routine, all defaulted, behaviour-neutral.
**Finished workout history is untouched** (snapshots preserved). No values are rewritten, only
defaults added to shapes that lack them.

## Scope

- Exercise model + editor: the `hasDuration` flag + default `durationSec`.
- Routine item: the per-set `durations` array + wherever `targets`/`suggestedWeights` are edited.
- The schema bump (v9) + `migrateState`/`migrateRoutine` defaulting + threading through
  `buildPlannedWorkout`/`workoutSnapshot`.
- The in-set countdown UI in `SetLogForm`/`WorkoutItemLive`, its own timer state, beep at zero.

## Out of scope

- Duration **progression** (increasing the target over time) — future.
- Reworking the cardio free-text "Duration" relabel (`progress.js:43`) — leave it; the new numeric
  duration is separate.
- Any change to finished workout history records.

## Acceptance criteria

- **Migration round-trip (failure-class):** a seeded `workout-mvp-v8` key (and an older v5) loads into
  v9 with **nothing lost**; `v8` is only removed after read-back confirms the v9 write (mirror the
  req-06 pattern, `storage.test.js:164-227`). Add a `legacyV8` round-trip test.
- **Non-timed unaffected (failure case):** an exercise without `hasDuration` logs weight/reps exactly as
  before; its stored shape gains only the defaulted fields.
- **Timed set (browser):** a `hasDuration` exercise shows Start → countdown from the target → beep at
  zero → Complete logs the duration; no weight/reps field where they don't apply.
- **Weighted+timed:** logs both weight and duration; weight still progresses next time, duration static.
- **No rest collision:** the in-set timer and the rest timer run independently — arming one never
  affects the other (guard against the `restEndsAt` reuse trap).
- **Backup + eyes gate:** Emilio exports a fresh backup and reviews the migration test **before** merge.
- **No regression:** `./check` green; the migration + a non-timed-unaffected test included.

## Decisions

- Model = (a) orthogonal `hasDuration` flag, not a new type (Emilio, 2026-09-16).
- Duration **replaces reps** for a timed set; weight orthogonal (Emilio, 2026-09-16).
- `durations` is **per-set** (parallel to targets/weights), not a single per-exercise value
  (Emilio, 2026-09-16).
- Completed timed set logs the **target** duration (editable), not stopwatch-actual, in v1
  (Emilio, 2026-09-16).
- **No duration progression** in v1 (Emilio, 2026-09-16).
- Exact field names / editor layout — implementation (CC), within the schema shape above.
