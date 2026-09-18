# Persistence: schema, migration, recommendation increments

Measured from the code on 2026-09-12, re-verified 2026-09-14; key/version re-verified 2026-09-18
after req-85's `v8→v9` bump (`src/storage.js`, `src/model.js`, `src/progress.js`). Durable facts a
requirement can lean on without re-deriving.
If the code changes, update this — a `DEC-` or req that moves the schema updates
here in the same pass.

## Keys

- **Live key:** `workout-mvp-v9`; `SCHEMA_VERSION = 9` (`model.js:5`, `storage.js:5`). (req-85
  bumped `v8→v9`; `v8` is now a legacy key.)
- **Legacy keys read for migration:** `workout-mvp-v8`, `-v7`, `-v6`, `-v5`
  (`storage.js:6`, `LEGACY_KEYS`). Removed **only after** the current (v9) value is read back
  and confirmed persisted (req-06 gate, `storage.js:removeLegacyKeysIfCurrentPersisted`
  — a silent-failed save must never trigger a delete).
- **Analytics** is a separate key `workout-mvp-analytics` (DEC-011), never in the
  backup, best-effort/swallowed writes — isolated from history.
- `src/db.json` is **provenance/reference only**, not imported at runtime; first
  run starts from `emptyState()` (empty arrays, `storage.js:30-42`).

## Load + migrate flow (`storage.js:loadState`, 140-184)

1. Read `workout-mvp-v9`; else the first non-null legacy key (`.find(Boolean)`).
2. No value → `emptyState()`.
3. `JSON.parse(raw)` → `migrateState({ ...emptyState(), ...parsed })`.
4. Re-`saveState` if there was no current v9 value or `parsed.schemaVersion !== 9`.
5. `removeLegacyKeysIfCurrentPersisted()` (read-back gated).
6. A throw in **parse/migrate** is the corrupt-but-present case (**DEC-032 / req-36,
   shipped**): latch `loadUnreadable`, return `emptyState()` under a distinct banner,
   and **`saveState` then refuses to write** — the raw value is preserved on disk and
   recoverable, never overwritten (`storage.js:163-183`, `186-189`; test
   `storage.test.js:320-340`). A throw reading `localStorage` *itself* (access denied)
   is treated as a blank device instead — `emptyState()`, signal clear (`storage.js:149-154`).

## migrateState is uniform, not version-branched (`model.js:221`)

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
  (`:72`). `programName` handling is **branch-specific** (req-37 finding): the
  snapshot-**less** branch reads `workout.programName || snapshot?.programName ||
  legacyProgram.programName` (`:183`); the snapshot-**present** branch keeps only
  what's inside `workout.snapshot` (it does not read top-level `workout.programName`).
  Real finished workouts carry `programName` in the snapshot, so it round-trips.
- **Opaque ids kept:** `sess-…`, `si-…` (item id fallback `si-…`, `model.js:14`).

## Migration test coverage (`storage.test.js`)

| version | round-trip test? | where |
|---|---|---|
| v8→v9 (current) | yes | `:725-815` (req-85: v8+v5 device loads into v9, timer defaults added, history untouched, throw leaves v8 intact) |
| v8 | yes | `:206-227` |
| v7 | yes | `:164-204` (`schemaVersion: 7`, routines shape) |
| v6 | yes | `:107-158` (`schemaVersion: 6`, programs/sessions shape) |
| v5 | yes | `:238-274` (`schemaVersion: 5`, programs shape; req-37, shipped) |

**F-RISK-1 (req-37, shipped):** there is **no distinct v5 on-disk shape in this repo's
git history** — the schema-version scheme predates the current history and
`migrateState` is uniform (no per-version branch). So "v5" is a version number the
code accepts on a legacy (program-wrapped) shape, not a separate transform. req-37
added the v5 round-trip test that (a) proves the `v5` key round-trips and (b) covers
the legacy paths v6/v7 tests miss — **workout-level `sessionId`/`programName`** and
**plan `sessionId`**.

## Recommendation increments (`progress.js`)

- `validWeights(exercise)`: `weightOptions` if present; else the `Alt 4/5` sequence
  (start 9, alternate +5/+4); else a numeric `weightStep`; else `[]`.
- `moveToValidWeight(w, ex, ±1)`: next/previous valid option. With **no valid
  increment** (`weightStep:'n/a'`, `[]`) the recommendation **holds** — no invented
  0.5 kg step (DEC-030; was `progress.js:28` fallback).
- `recommendNextPrescription`: missed reps or `rpe>=5` → down one step; `rpe<=2` and
  not missed → up one step; else keep. Bodyweight/cardio adjust **reps**, not weight.
- Computed from history and nothing else; decision is inspectable (DESIGN §2).
