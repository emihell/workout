# Persistence: schema, migration, recommendation increments

Re-measured 2026-09-25 from `main` after req-165 (field list measured by Builder from the migrated golden state + a grep
of the writers, `reports/req-165.md`). Supersedes the 2026-09-12/-14/-18 version (its "migrateState is uniform" and
"cardio adjusts reps" claims were wrong — audit 2026-09-24 F-DRIFT-3). A `DEC-` or req that moves the schema updates this
in the same pass.

**Updated 2026-10-10 (Planner)** for req-193/194/211/212 from the rescans of `main` 98f94cf (Explore agents, cited per
line below). Not re-measured from a golden state; a builder touching the schema re-measures.

**Updated 2026-10-31 (Planner, audit 2026-10-30 F-DRIFT-7)** from `main` `78d6bc9`: the server DB, the sync and device keys,
the load pointer. Read this session, cited per line.

## Keys, load and write rules

- **Live key** `workout-mvp-v9` (`SCHEMA_VERSION = 9`). **Legacy keys** `-v8`…`-v5` are read for migration and removed
  **only after** the v9 value is read back and confirmed persisted (req-06).
- **Load:** read v9, else the first legacy key → `JSON.parse` → `migrateState(…, { legacy })` — **version-branched**:
  `legacy` is true for any legacy key or a v9 key whose `schemaVersion !== 9` (`persistence.js:187` loadState; since
  req-164 `storage.js` is only a re-export shim, `storage.js:1-8`), and for an import,
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
`buildPlannedWorkout`), **L** = live logging (store.jsx / the req-270 workout modules, `workout-*.js`, `set-*.js`), **F** = Finish (`finishedState`),
**H** = History edits, **E** = exercise/routine editors, **I** = import (exchange.js → M).

`localStorage` keys:
- `workout-mvp-v9`: the state (below).
- `workout-mvp-v8` … `v5`: legacy, read once, removed after a read-back-confirmed v9 save.
- `workout-mvp-unreadable-<ISO>[~n]-<v9|v8|…>`: the raw copy kept on an unreadable-state Import (DEC-086); never read or
  deleted by the app. There are req-157-era copies without the suffix.
- `workout-mvp-analytics` (analytics.js).
- `workout-dev-notes-v1`, `workout-feedback-enabled-v1`, `workout-dev-tools-v1` (`dev/dev-notes.js:21,25,196`).
- `workout-sync-v1` — the sync meta (`sync/engine.js:47`, defaults `:57-68`): `user` (logged in here; null → login
  screen), `syncedUser` (who this data last synced as), `rev` + `revId` (the server revision the data is based on; the id
  because a restore can reuse a number), `syncedAt`, `dirty` + `dirtyMark` (a local change not yet sent; which tab marked
  it), `notesDirty`, `expired` (server said 401), `diskBehind` (the last state save failed). Not the state itself.
- `workout-routine-kg-filled` — an ISO time, set once the routine-kg fill has run on this device (`routine-kg-fill.js:19-21`);
  deliberately outside `workout-mvp-` so the unreadable-copy scan and legacy cleanup skip it.

Not `localStorage`: `workout-mvp-backup` is the Export file's `kind` (`exchange.js:7`); `workout-app-` prefixes the
service-worker cache names (`sync/sw.js:17`).

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
- `weightStep` (string: `"2.5"`, `"Steps A/B"` two alternating sizes, `"Alt 4/5"` legacy, `"n/a"`).
- `lightestWeight` (kg, optional; req-193 — the first weight of the stack; suggestions count from it, `progress.js:9-31`).
- `archivedAt` (ISO | null, M → null).
- `hasDuration` (bool, M → false).
- `durationSec` (number, M → default).
- `libraryId` (string, optional; set by the library picker).
- `unilateral` (bool, optional; req-240 — written only when the user changes "One side at a time" in Details; absent → the
  library entry decides "each side", `library-hints.js` `isEachSide`). Not shown for cardio.
- plus the library fields the picker copies.

**Routine** (E):
- `id`, `name`, `focus`, `archivedAt` (ISO | null).
- `exercises[]` items: `id`, `exerciseId`, `role`, `sets` (number), `targets[]` (strings), `suggestedWeights[]`
  (numbers), `durations[]` (seconds, timed), `restSec`, `notes`, `warmup` (`{reps, …}` | null).

**Schedule** (E; M normalises slots):
- `loopWeeks` (number) and `anchor` (date string; loadState defaults it once, req-114).
- `slots[]`: `id`, `week`, `weekday`, `routineId`.
- `moves[]` (req-211, DEC-117 §2): `{id, slotId, from, to}` — a one-date move inside the same Mon–Sun week; `slotsOn` honours
  it only while the slot is on `from`; malformed ones dropped by `normaliseMoves` (`model.js:279-348`, `schedule.js:82-84`).

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
- `rpe` (number | null; null on WU/cardio since req-156). **Since req-212 (DEC-119 §1) effort is per exercise:** Done logs
  `null`; the exercise review writes one value (2 Easy · 3 Medium · 4 Hard) to every logged non-skipped work set of that item;
  a set logged after a pick inherits it (`set-drafts.js` `formFieldsWithDraft`, `workout-items.js` `withItemEffort`, `item.jsx:280-284`). 5 (Failure) is legacy, still read.
- `note`.
- `targetReps`, `targetWeight` (number | null).
- `durationSec` (timed work sets; History too since req-163; cardio duration since req-194).
- `level`, `distance`, `distanceUnit` (cardio, req-194; each only when entered, `cardio-set.js:108-116`).
- `loggedAt` (ISO; req-212 — set when Done / Skip set logs it, never rewritten by edits; absent on older sets and on Finish's
  skipped fill).

**Active workout:** the finished-workout fields with `finishedAt: null`, plus these transient ones, all stripped by F:
- `seedOverrides {<exerciseId::wu|work>: {weight}}` (S → {}, L).
- `setDraft {key, weight, reps, effort, durationSec?, note}` (L, req-125).
- `autoFinishDismissed` (bool, req-116).
- `restEndsAt` / `restPausedRemaining` (L).

## Server DB (`workout.db`)

SQLite (`node:sqlite`), one file per server in the data dir — `~/dev/workout/workout-data/` by default, overridable by
`WORKOUT_DATA_DIR`, refused inside a git worktree (`server/config.mjs:14-17,40,63`). Schema `server/db.mjs:13-75`;
`PRAGMA user_version` = 1 (`DB_SCHEMA_VERSION`, `:11`; any other version refuses to open, `:86-91`). New tables/columns
are additive and added on open, no version bump (`:47-64`, `addRevisionColumns` `:100-113`). Every user-data query filters
on `user_id` (`:3-4`).

| Table | Columns | Meaning |
|---|---|---|
| `users` | `id`, `username` UNIQUE, `password`, `disabled` (0/1), `created_at` | Invite-only accounts. `password` = `scrypt$N$r$p$salt$hash` (`auth.mjs:3,38-39`). |
| `invites` | `code_hash` PK, `created_at`, `expires_at`, `used_by` → users, `used_at` | Codes stored hashed; valid `INVITE_DAYS` = 7 (`auth.mjs:13,90-92`). |
| `sessions` | `token_hash` PK, `user_id`, `created_at`, `expires_at` | Login cookie, hashed; `SESSION_DAYS` = 90, pushed out on use (`auth.mjs:12`, `app.mjs:73,192`). |
| `revisions` | PK (`user_id`, `rev`); `state` (the whole v9 JSON), `base_rev`, `merged` (0/1), `conflicts` (JSON list, `'[]'` = none), `created_at`, `source`, `note` | One row per accepted push — the full document each time (`store.mjs:207-208`). `source`/`note`: who wrote it and why, set by `./server/ops plan apply/revert`, null for a device push (`db.mjs:95-99`, req-245). The revision id is a hash of `rev|created_at|state` (`store.mjs:77-79`). |
| `pruned_revisions` | PK (`user_id`, `rev`, `rev_id`) | A revision removed by pruning, so a device still based on it reads `pruned`, not `restored` (`store.mjs:274-288`). |
| `restores` | `user_id`, `rev`, `at` | One row per user each time `./server/restore` puts a backup back: the rev the copy ended at (`db.mjs:56-64`, `store.mjs:240-242`). |
| `notes` | `id`, `user_id`, `route`, `timestamp`, `text`, `context` (JSON object), `created_at`; UNIQUE (`user_id`, `timestamp`, `text`) | The feedback notes from every screen (`dev/dev-notes.js` record, `store.mjs:303-312`); the UNIQUE makes a resend a no-op. |

**Pruning** (`store.mjs:247-271`, run in the write that adds a revision): drops revisions older than `PRUNE_DAYS` = 14,
except the newest of each UTC day, any with conflicts, the current one, any a `restores` row names, and any with `source`
set (Coach's changes stay revertable). Size grows with history on every push — audit 2026-10-30 F-SYNC-2 (BACKLOG).

## Recommendation increments (`progress.js`)

- `validWeights(exercise)`: `weightOptions` if present; else the `Alt 4/5` sequence
  (start 9, alternate +5/+4); else a numeric `weightStep`; else `[]`.
- `moveToValidWeight(w, ex, ±1)` (`progress.js:69-82`): next/previous valid option; at or below `lightestWeight` "down"
  holds with a reason (req-193). With **no valid
  increment** (`weightStep:'n/a'`, `[]`) the recommendation **holds** — no invented
  0.5 kg step (DEC-030; was `progress.js:28` fallback).
- `recommendNextPrescription`: missed reps or `rpe>=5` → down one step; `rpe<=2` and
  not missed → up one step; else keep (Hard = 4 keeps). Only `type === 'bodyweight'` adjusts **reps** (±1); cardio holds.
- Computed from history and nothing else; decision is inspectable (DESIGN §2).
