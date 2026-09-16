# req-85 — timed exercises (duration sets), v8→v9 schema bump — report

Branch: `req-85` (off `52a759d`). `./check` green (lint + 261 tests + build). **Not merged.**
This is the schema-version bump — merge is gated on Emilio's fresh Export backup + his eyes
on the migration test (CLAUDE.md ask-gate #2 / DEC-046). I built and tested it on the branch
only; nothing here writes to real `localStorage`.

## What the migration changes, and to how many record kinds

The migration is the single, idempotent, shape-driven `migrateState` (model.js) — not a step
chain. On first load after deploy it adds **defaulted, behaviour-neutral fields to two record
kinds**, rewriting no existing values:

| Record kind | Field added | Default |
|---|---|---|
| every **exercise** | `hasDuration` | `false` |
| every **exercise** | `durationSec` | `30` (`DEFAULT_DURATION_SEC`) |
| every **routine item** | `durations` (per-set seconds array) | `[]` |

**Finished workout history is untouched** — snapshots are preserved (`workoutSnapshot`'s
already-snapshotted branch spreads `...rest`; only the legacy-rebuild branch was threaded).
The storage key bumps `workout-mvp-v8 → workout-mvp-v9`, and `v8` is prepended to
`LEGACY_KEYS`. The req-06 read-back gate is unchanged in behaviour: legacy keys (now including
v8) are deleted **only after** the v9 write is confirmed by reading it back — a failed or
silent write leaves the old copy intact.

## Migration-test output (the receipt Emilio should see)

```
$ node --test src/storage.test.js src/model.test.js   (req-85 subtests)
# Subtest: req-85 v9 migration round-trip
    ok 1 - loads a v8 (+v5) device into v9 with nothing lost and only defaults added
    ok 2 - a throwing write leaves the v8 copy intact (no premature delete)
ok 18 - req-85 v9 migration round-trip
# Subtest: req-85 timed-exercise schema (v9)
ok 32 - req-85 timed-exercise schema (v9)   (5 subtests: exercise defaults, preserve
        existing hasDuration/durationSec, routine-item durations default+preserve,
        buildPlannedWorkout threading, legacy workoutSnapshot threading)

$ ./check
check: green — lint, 20 test file(s), and the build all passed.
# tests 261  # pass 261  # fail 0
```

The round-trip test seeds a real `workout-mvp-v8` key (exercise + routine with a 3-set
prescription + one finished workout) plus an older `workout-mvp-v5`, loads, and asserts:
nothing lost (targets/weights/sets intact), only the new fields defaulted, the logged set
gains **no** `durationSec`, persisted as v9 (`schemaVersion: 9`), and both legacy keys
reclaimed after the read-back. The second case proves a throwing write keeps the v8 copy.

## Technical — what changed

**Schema / model (`model.js`)**
- `SCHEMA_VERSION 8 → 9`; added `DEFAULT_DURATION_SEC = 30`.
- `migrateState` exercise map defaults `hasDuration`/`durationSec`; `migrateRoutine` defaults
  `durations: []`.
- Threaded `durations` through `buildPlannedWorkout` (plan item) and the **legacy-rebuild**
  branch of `workoutSnapshot`. `planSnapshot` structuredClones — no change.

**Storage (`storage.js`)** — `STORAGE_KEY → 'workout-mvp-v9'`; `'workout-mvp-v8'` prepended to
`LEGACY_KEYS`. Renamed `removeLegacyKeysIfV8Persisted → removeLegacyKeysIfCurrentPersisted`
(it already keyed off `STORAGE_KEY`, so behaviour is identical — just no longer says "v8").

**Store (`store.jsx`)** — `addExercise` defaults `hasDuration`/`durationSec`; `updateExercise`
already spreads the patch. `addRoutineExercise`/`updateRoutineExercise` default/thread `durations`.

**Exercise editor (`Exercises.jsx`)** — a "Timed (count down a duration)" checkbox + a
"Default duration (s)" field (shown when timed) in `ExerciseEdit`; detail line shows `Timed Ns`.

**Routine item editor (`Routine.jsx`)** — a "Duration (s)" field (slash/comma per-set, like
Kg), shown only when the exercise `hasDuration`; parsed into the per-set `durations` array.

**In-set countdown (`ui/index.jsx` `SetLogForm` + new `DurationTimer`; `item.jsx`)** — for a
timed **work** set the reps field is replaced by an editable seconds field + a live count-down +
Start/Restart, beeping once at zero (`defaultBeep`, fail-silent). The set logs the **target**
seconds (editable), `reps: ''`. The timer is **component-local state** (a deadline + a 250ms
tick) — it never reads or writes `restEndsAt`, so it can't collide with the rest timer.
`formatSetLine` (`ids.js`) shows `Ns`.

**Tests** — `model.test.js`: 5 schema/threading subtests. `storage.test.js`: the v9 round-trip
(+ throwing-write) above. Updated the existing storage/dev-notes/analytics tests that hardcoded
`workout-mvp-v8` as the **current** key to `v9` (mechanical, driven by the intended key change —
intent unchanged: the corrupt-current / already-current / real-history-guard cases still hold,
now against v9, with v8 exercised as a legacy key).

**Choices left open by the spec**
- **`durationSec` is a separate numeric set field**, not reps overloaded — the spec's "separate
  numeric seconds field, NOT [the cardio reps-relabel]". `reps` stays `''` for a timed set.
- **`DEFAULT_DURATION_SEC = 30`**; target resolution: routine item `durations[i]` → last in that
  array → exercise `durationSec` → 30. Never invents beyond that default.
- **Logged value = the target** (editable), not a stopwatch actual (per decision, v1). Complete
  is live at any time; the countdown only guides + beeps.
- **Timed applies to work sets only**; a warmup set stays reps-based.

## Workflow

- **No scope drift** — all of the spec's schema + threading + editor + in-set countdown.
- **Deviation to flag:** the schema bump forced updating ~a dozen existing storage/dev-notes/
  analytics test assertions that treated `workout-mvp-v8` as the live key. I updated them to v9
  (and swapped comments), keeping each test's intent. This is expected churn for a key bump but
  worth a reviewer's eye — I did **not** weaken any assertion, only re-pointed the key name.
- **Known v1 gaps (browser-verify / future):** (1) the set-edit screen (`set-edit.jsx`) can't
  edit `durationSec` yet — an existing timed set's duration is **preserved** on edit (merge
  spread) but not changeable there; (2) a timed **bodyweight** work set (e.g. plank) still
  requires an effort pick, same as any bodyweight set today — flag for gym-feel.
- No `DEC`/`L` proposed beyond recording the v9 shape (already in the spec) and, if wanted, a
  note that `buildFinishProgression`-style shared-helper discipline paid off again here (the
  finish path was untouched).
