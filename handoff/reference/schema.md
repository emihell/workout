# Persistence: schema, migration, recommendation increments

Measured from the code on 2026-09-12 (`src/storage.js`, `src/model.js`,
`src/progress.js`). Durable facts a requirement can lean on without re-deriving.
If the code changes, update this — a `DEC-` or req that moves the schema updates
here in the same pass.

## Keys

- **Live key:** `workout-mvp-v8`; `SCHEMA_VERSION = 8` (`model.js:3`).
- **Legacy keys read for migration:** `workout-mvp-v7`, `-v6`, `-v5`
  (`storage.js:5`, `LEGACY_KEYS`). Removed **only after** the v8 value is read back
  and confirmed persisted (req-06 gate, `storage.js:removeLegacyKeysIfV8Persisted`
  — a silent-failed save must never trigger a delete).
- **Analytics** is a separate key `workout-mvp-analytics` (DEC-011), never in the
  backup, best-effort/swallowed writes — isolated from history.
- `src/db.json` is **provenance/reference only**, not imported at runtime; first
  run starts from `emptyState()` (empty arrays, `storage.js:30-42`).

## Load + migrate flow (`storage.js:loadState`, 64-80)

1. Read `workout-mvp-v8`; else the first non-null legacy key (`.find(Boolean)`).
2. No value → `emptyState()`.
3. `JSON.parse(raw)` → `migrateState({ ...emptyState(), ...parsed })`.
4. Re-`saveState` if there was no current v8 value or `parsed.schemaVersion !== 8`.
5. `removeLegacyKeysIfV8Persisted()` (read-back gated).
6. Any throw in the whole block → `emptyState()`. **Caveat (F-RISK-2/DEC-032):** a
   *corrupt but present* v8 value currently also falls here and is then overwritten
   — the open req changes this to preserve + banner.

## migrateState is uniform, not version-branched (`model.js:219`)

The same transform runs regardless of the source `schemaVersion` — v5/v6/v7 are
distinct on-disk **shapes**, not distinct code paths. What it does:

- **Routines:** `source.routines` used as-is (v7 shape) via `migrateRoutine`; else
  `source.programs[].sessions` flattened into `routines` (v5/v6 program-wrapped
  shape) (`model.js:52-59`). `delete interim.programs` (`:259`).
- **Schedule slots:** `slot.routineId || slot.sessionId` → `routineId`; `id` minted
  if missing (`model.js:233-238`).
- **Plans:** `sessionId` → `routineId` (`model.js:247-250`).
- **Workouts:** re-snapshotted + `stripLegacyWorkoutKeys` (`delete sessionId`,
  `model.js:205-208`); `routineId = workout.routineId || workout.sessionId`
  (`:72`). Legacy `programName` preserved onto the snapshot if present (`:183`).
- **Opaque ids kept:** `sess-…`, `si-…` (item id fallback `si-…`, `model.js:14`).

## Migration test coverage (`storage.test.js`)

| version | round-trip test? | where |
|---|---|---|
| v8 | yes | `:206-227` |
| v7 | yes | `:164-204` (`schemaVersion: 7`, routines shape) |
| v6 | yes | `:107-158` (`schemaVersion: 6`, programs/sessions shape) |
| **v5** | **NO** | only a delete-assertion `:182`; no seed-and-upgrade |

**F-RISK-1 open:** the v5 on-disk shape must be reconstructed from git history
(what distinguished v5 from v6) before a v5 round-trip test can be written; pin the
reconstructed shape here when that req runs.

## Recommendation increments (`progress.js`)

- `validWeights(exercise)`: `weightOptions` if present; else the `Alt 4/5` sequence
  (start 9, alternate +5/+4); else a numeric `weightStep`; else `[]`.
- `moveToValidWeight(w, ex, ±1)`: next/previous valid option. With **no valid
  increment** (`weightStep:'n/a'`, `[]`) the recommendation **holds** — no invented
  0.5 kg step (DEC-030; was `progress.js:28` fallback).
- `recommendNextPrescription`: missed reps or `rpe>=5` → down one step; `rpe<=2` and
  not missed → up one step; else keep. Bodyweight/cardio adjust **reps**, not weight.
- Computed from history and nothing else; decision is inspectable (DESIGN §2).
