# Persistence: schema, migration, recommendation increments

Re-measured 2026-09-25 from `main` after req-165 (field list measured by Builder from the migrated golden state + a grep
of the writers, `reports/req-165.md`). Supersedes the 2026-09-12/-14/-18 version (its "migrateState is uniform" and
"cardio adjusts reps" claims were wrong — audit 2026-09-24 F-DRIFT-3). A `DEC-` or req that moves the schema updates this
in the same pass.

## Keys, load and write rules

- **Live key** `workout-mvp-v9` (`SCHEMA_VERSION = 9`). **Legacy keys** `-v8`…`-v5` are read for migration and removed
  **only after** the v9 value is read back and confirmed persisted (req-06).
- **Load:** read v9, else the first legacy key → `JSON.parse` → `migrateState(…, { legacy })` — **version-branched**:
  `legacy` is true for any legacy key or a v9 key whose `schemaVersion !== 9` (`storage.js` loadState), and for an import,
  `backupIsLegacy(raw)` (`exchange.js`). Callers **must** pass `legacy` for pre-v9 input (comment at the signature). A
  missing schedule anchor is defaulted and saved once (req-114); a non-object parse is rejected as unreadable.
- **Unreadable** (DEC-032): a parse/migrate throw latches the lock; `saveState` refuses every write. The one way out is
  Import (req-157/161, DEC-086): after the confirm, every present workout key is copied to
  `workout-mvp-unreadable-<ISO>[~n]-<v9|v8|…>` and verified by read-back, the load's value is downloaded as `.txt`, and only
  then the lock lifts and the import saves. Copies are never read or deleted by the app.
- **Recommendation holds** (DEC-075/076): an unreadable target (range, AMRAP, duration, text) and any assisted exercise
  hold; only `type === 'bodyweight'` adjusts reps — cardio holds.

## v9 field list

Measured from the migrated golden state (key paths and types), plus the fields only a live session writes (grep of the
writers). Writers: **M** = `migrateState` (load/import, model.js), **S** = Start (`store.startWorkout` /
`buildPlannedWorkout`), **L** = live logging (store.jsx / workout-log.js), **F** = Finish (`finishedState`),
**H** = History edits, **E** = exercise/routine editors, **I** = import (exchange.js → M).

`localStorage` keys:
- `workout-mvp-v9`: the state (below).
- `workout-mvp-v8` … `v5`: legacy, read once, removed after a read-back-confirmed v9 save.
- `workout-mvp-unreadable-<ISO>[~n]-<v9|v8|…>`: the raw copy kept on an unreadable-state Import (DEC-086); never read or
  deleted by the app. There are req-157-era copies without the suffix.
- `workout-mvp-analytics` (analytics.js).
- `workout-dev-notes-v1`, `workout-feedback-enabled-v1` (dev/dev-notes.js).

`sessionStorage`: `workout-mvp-nav-2` (a one-element array: the last visited path, route.js).

State (`workout-mvp-v9`):

**Root:**
- `schemaVersion` 9 (M).
- `exercises[]`, `routines[]`, `schedule`, `workouts[]`.
- `draftWorkouts[]`: legacy; M; promoted by continueInProgress.
- `activeWorkout` (object | null).
- `plannedWorkouts[]`: legacy; M normalises it; no longer read or written.
- `legacyRecommendations {<routineItemId>: {sets, targets[], suggestedWeights[]}}`: M, legacy input only (req-158).

**Exercise** (E; M defaults):
- `id`, `name`, `equipment`, `muscles`, `cues`, `type` (`machine|free|bodyweight|cardio|assisted…`).
- `weightStep` (string: `"2.5"`, `"Alt 4/5"`, `"n/a"`).
- `archivedAt` (ISO | null, M → null).
- `hasDuration` (bool, M → false).
- `durationSec` (number, M → default).
- `libraryId` (string, optional; set by the library picker).
- plus the library fields the picker copies.

**Routine** (E):
- `id`, `name`, `focus`, `archivedAt` (ISO | null).
- `exercises[]` items: `id`, `exerciseId`, `role`, `sets` (number), `targets[]` (strings), `suggestedWeights[]`
  (numbers), `durations[]` (seconds, timed), `restSec`, `notes`, `warmup` (`{reps, …}` | null).

**Schedule** (E; M normalises slots):
- `loopWeeks` (number) and `anchor` (date string; loadState defaults it once, req-114).
- `slots[]`: `id`, `week`, `weekday`, `routineId`.

**Workout, finished** (F; H edits; M rebuilds legacy snapshots):
- `id`, `routineId`, `occurrenceId`, `scheduleSlotId`, `scheduledFor`, `performedOn`.
- `startedAt`, `finishedAt` (ISO).
- `overallNote`, `overallFeel`.
- `completedItemIds[]`.
- `restEndsAt`, `restPausedRemaining` (null after F).
- `schemaVersion` (on migrated legacy workouts).
- `progression`: legacy; old workouts only, no longer written (req-158).
- `snapshot`: `routineId`, `routineName`, `focus`, optional `programId` / `programName`, and `items[]`.

**Snapshot item** (S; req-109 replacements L; H "added during correction" items):
- `id`, `routineItemId`, `exerciseId`, `exerciseName`, `equipment`.
- `exerciseType` and `hasDuration` (frozen at Start).
- `weightStep`, `role`, `sets`, `targets[]`, `suggestedWeights[]`, `durations[]`, `restSec`, `notes`, `warmup`.
- `addedSets` (number: Add set count, req-117).
- `addedMidWorkout` (true on a replacement, req-109).

**Set** (L; F writes skipped ones; H edits):
- `exerciseId`, `routineItemId`.
- `setType` (`wu|work`).
- `weight` (number; History allows `''`).
- `reps` (string, or `'skipped'`).
- `rpe` (number | null; null on WU/cardio since req-156).
- `note`.
- `targetReps`, `targetWeight` (number | null).
- `durationSec` (timed work sets; History too since req-163).

**Active workout:** the finished-workout fields with `finishedAt: null`, plus these transient ones, all stripped by F:
- `seedOverrides {<exerciseId::wu|work>: {weight}}` (S → {}, L).
- `setDraft {key, weight, reps, effort, durationSec?, note}` (L, req-125).
- `autoFinishDismissed` (bool, req-116).
- `restEndsAt` / `restPausedRemaining` (L).

## Recommendation increments (`progress.js`)

- `validWeights(exercise)`: `weightOptions` if present; else the `Alt 4/5` sequence
  (start 9, alternate +5/+4); else a numeric `weightStep`; else `[]`.
- `moveToValidWeight(w, ex, ±1)`: next/previous valid option. With **no valid
  increment** (`weightStep:'n/a'`, `[]`) the recommendation **holds** — no invented
  0.5 kg step (DEC-030; was `progress.js:28` fallback).
- `recommendNextPrescription`: missed reps or `rpe>=5` → down one step; `rpe<=2` and
  not missed → up one step; else keep. Bodyweight/cardio adjust **reps**, not weight.
- Computed from history and nothing else; decision is inspectable (DESIGN §2).
