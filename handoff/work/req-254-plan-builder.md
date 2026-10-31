**Status: READY** · **Lane: tooling** · DEC-145 §4, DEC-146, DEC-151, DEC-141/142, DEC-128 §5. After req-245 (builds on `server/plan.mjs`).

# req-254 — `ops plan build`: a short change list → a checked plan file for `ops plan preview`

## Why (observed)

Every Coach run that ends in a plan writes its own builder against `src/`: run 3 `scripts/build_import.mjs` (132 lines) +
`validate.mjs` (29), run 4 `build_import.mjs` (86) + `validate.mjs` (24) (`wc -l` in `workout-data/coach/run-{3,4}/scripts/`,
2026-10-31; contents not read, L-066). COACH.md:96-102 tells each run to do this until a plan-builder ships. Each script
re-derives how the app makes an exercise, keeps history and validates, so each run can get it wrong differently — and nothing
checks that a run's file changed **only** what the run meant to change.

## What exists (read 2026-10-31, `main` `b178877`)

- `server/plan.mjs:34-44` `readPlanFile` (Export or bare state; needs `exercises` + ≥1 routine; `validState`).
  `:87-122` `planChange(current, incoming)` → `{result, lines, counts, refusals, unchanged}`: Keep my history
  (`keptHistoryState`, `src/exchange.js:764`), refusals for a workout in progress / history mismatch (`:93-102`).
  `:125` `previewPlan(db, userId, …)` reads the newest revision via `getState`.
- `server/ops-cli.mjs:280-294` `plan preview`: read-only DB handle (`DatabaseSync(…, {readOnly: true})`), `pickUser` (`:222`,
  `--user` or the only account), `printPlan` (`:233`). `server/ops` → `require_server_machine` (req-249).
- How the app makes a library exercise: `exerciseFromData(catalogItemToExercise(entry), uid('ex'))` (`src/store.jsx:170`,
  `src/views/Exercises.jsx:386`, `src/views/ExercisePicker.jsx:192`; `src/exerciseCatalog.js:219`, `src/exercise-names.js:69`).
  Library: `src/library/exercises.json`, 944 entries, fields incl. `id`, `hidden`, `mergedInto` (`node -e` count, 2026-10-31).
- How the app fills a new routine item: `pickerItem(workouts, exercise)` (`src/routine-picker.js:108`) — history
  (`historyPrescription`, `src/history-queries.js:229`) when there is some, else a starting plan with blank kg. Item ids `uid('si')`, routines `uid('rtn')`,
  slots `uid('slot')` (`src/store.jsx:80,97,131`).
- **Item ids carry history:** a logged set links to its routine item by `routineItemId` (`src/workout-log.js:13-22`,
  `src/history-queries.js:89-108`). A rebuilt item with a fresh id loses that link [inferred from those lines; the builder
  confirms with a test].
- Field truth: `reference/schema.md` §v9 (Routine item: `id, exerciseId, role, sets, targets[], suggestedWeights[], durations[],
  restSec, notes, warmup`). What a plan may contain: `coach/CAPABILITIES.md`.
- `isDurationTarget` labels "12 reps" as Duration (`src/progress.js:89-92`, CAPABILITIES:78).

## Scope

1. **`server/plan-build.mjs`** — pure `buildPlan(current, changes, {library, makeId, now})` → `{state, lines, warnings,
   refusals}`. No DB, no fs.
2. **`./server/ops plan build <changes.json> --out <file> [--user <u>]`** in `ops-cli.mjs`: the newest revision of that user,
   read-only exactly as `plan preview` opens it; writes `--out` only when there are no refusals.
3. **The change list** (JSON, written by Coach in its run folder):

   ```json
   { "kind": "workout-plan-changes", "version": 1, "changes": [
     { "op": "exercise.add",    "ref": "rdl", "libraryId": "<id>", "set": { "weightStep": "2.5" } },
     { "op": "exercise.set",    "exercise": "Leg Press", "set": { "weightStep": "5", "lightestWeight": 10 } },
     { "op": "routine.add",     "ref": "B", "name": "…", "focus": "…", "items": [ ITEM, … ] },
     { "op": "routine.set",     "routine": "Legs A", "set": { "name": "…", "focus": "…" } },
     { "op": "routine.items",   "routine": "Legs A", "items": [ ITEM, … ] },
     { "op": "item.set",        "routine": "Legs A", "exercise": "Leg Press", "set": { "suggestedWeights": [60, 60, 60] } },
     { "op": "routine.archive", "routine": "Legs old" },
     { "op": "schedule.set",    "loopWeeks": 2, "slots": [ { "week": 1, "weekday": 1, "routine": "B" } ] }
   ] }
   ```

   - `ITEM` = `{ "exercise": <ref>, …any of sets, targets, suggestedWeights, durations, restSec, role, warmup, notes }` —
     stored field names (schema.md), no aliases.
   - A reference resolves by `id`, by a `ref` defined earlier in the same file, or by exact name among non-archived records.
     Zero or several matches → refusal naming the candidates' ids.
   - `routine.items` = the routine's whole ordered list. An item whose exercise is already in that routine **keeps its `id`**
     and its existing values, overridden by the fields given; a repeated exercise matches in order. A new item starts from
     `pickerItem(workouts, exercise).item` (the app's add path) with the given fields on top, and gets a new `si` id.
   - `exercise.set` / `exercise.add` `set` may hold only: `weightStep`, `lightestWeight`, `unilateral`, `hasDuration`,
     `durationSec`, `cues`. `routine.set` only `name`, `focus`.
   - `schedule.set` replaces `loopWeeks` and `slots`. A slot that equals a current one (week, weekday, routine) keeps its
     `id`. `moves`, `swaps` and `anchor` are kept.
   - `routine.archive` sets `archivedAt` (`now`); nothing is ever deleted.
4. **Checks — any one refuses, nothing written:**
   - **C1 history identical:** `workouts`, `draftWorkouts`, `activeWorkout`, `plannedWorkouts`, `legacyRecommendations`
     deep-equal the base.
   - **C2 only the named records changed:** after the ops run, a separate diff of base vs result by id (exercises, routines,
     slots, the schedule's other fields): every added/changed/archived record must be one a change named. This guards the
     builder's own code, so it is computed from the two states, not from the op list's bookkeeping.
   - **C3 references:** every item's `exerciseId` → a non-archived exercise; every slot's `routineId` → a non-archived routine.
     A library id that is `hidden` or has `mergedInto` → refused, naming the target. An `exercise.add` whose `libraryId` an
     existing non-archived exercise already has → refused (use that one).
   - **C4 item shape** (CAPABILITIES §How a plan runs): `sets` an integer ≥ 1; `targets` and a non-empty `suggestedWeights`
     have exactly `sets` entries (timed: `durations` has `sets` entries, each > 0); `restSec` an integer ≥ 0; `role` one of
     `ROUTINE_ROLES` (`src/ids.js`); `warmup` null or `{reps}`.
   - **C5 no invented kg** (DESIGN §1, DEC-096): a changed `suggestedWeights` with any value > 0 on an item whose exercise has
     no history (`historyPrescription(workouts, id)` is null) → refused.
   - **C6 what the workout can't run** (DEC-146/151): a non-cardio, non-timed target that `isDurationTarget` reads as Duration
     ("12 reps", "60s") → refused, "write reps as a bare number / use hasDuration". A timed item with ≥ 2 sets and
     `restSec` < 30 → refused (an interval under DEC-151's 30 s).
   - **C7 the server's own check:** `readPlanFile(output)` accepts it and `planChange(base, output)` has no refusals — the same
     functions `plan preview` runs (no second copy of the rules, DEC-128 §5).
   - Also refused: an empty `changes`, an unknown `op` or field, a wrong `kind`/`version`, `--out` already existing.
5. **Warnings (printed, not refusing):** a target that isn't a plain number ("10-12", "AMRAP": logged as typed,
   `src/workout-log.js:613-615`); a duration < 30 s; `restSec` 0 with notes (notes never show); `notes` containing
   superset / circuit / EMOM / tabata / warm-up (DEC-146 — a hint, not a check: it tests spelling).
6. **Output:** the file as `buildBackup(state)` (Export shape). Printed: `built on rev N for <user>`; one line per change,
   before → after (e.g. `Legs A · Leg Press: kg 55/55/55 → 60/60/60; rest 90 → 120`, `+ item Romanian Deadlift (from
   history: 3 × 8 · 40 kg)` / `(starting plan, no kg)`); the warnings; then the same `printPlan` lines and counts `plan
   preview` prints; last line `next: ./server/ops plan preview <out> [--user <u>]`. Exit 1 on any refusal.
7. Tests (`server/req-254.test.mjs`, temp data dirs only, BACKEND rule 8) and a usage line in `ops-cli.mjs:1-11`.

## Out of scope

- Applying: `plan apply` stays the only write, asks Emilio, unchanged (DEC-141/142). `build` never writes the DB.
- New features the change list can't express (supersets, intervals, cues in the workout, …) — their reqs extend `ITEM` and C4/C6
  when they ship (see Order).
- Editing exercises' names/types/equipment, deleting anything, editing `moves`/`swaps`, a plan for several users at once.
- `handoff/coach/*` — Planner updates COACH.md:96-102 and CAPABILITIES §Getting a plan into the app at closeout.

## Steps

1. `plan-build.mjs`: resolve references → apply ops on a clone → C1–C6 → `planChange` (C7) → lines. Reuse
   `exerciseFromData`, `catalogItemToExercise`, `pickerItem`, `historyPrescription`, `isDurationTarget`, `buildBackup`; don't
   re-implement them.
2. `ops-cli.mjs` `plan build`, sharing `pickUser`, `printPlan`, the read-only open.
3. Tests per the criteria; `./check`.

## Acceptance criteria

1. **Round trip:** on a temp data dir seeded with req-245's `phoneState` (`fullState()` with `activeWorkout: null`, `server/req-245.test.mjs:28`), a change list that edits one item's kg
   and rest, adds a library exercise to a routine, archives one routine and sets the schedule → `plan build` exits 0; its file
   passes `ops plan preview` with **no refusals**, and preview's counts equal the ones `build` printed.
2. **Only what was named:** in that output every exercise/routine/slot not named is deep-equal to the base; the edited item
   keeps its `id`; `workouts` deep-equal. Receipt: the test's assertions.
3. **C2 fires (the tooling-lane self-test):** the C2 function, given a result where an unnamed routine's item was altered,
   refuses naming that routine — so C2 can't pass because the ops happened to be right.
4. **Right mechanism:** a new item for an exercise **with** history gets `pickerItem`'s values and its line says "from
   history"; one **without** history gets blank kg and says "starting plan". A change list giving kg 40 to the latter →
   refused (C5), no file.
5. **Failure cases, each exit 1 and no `--out` file:** an empty `changes`; a name matching two exercises (both ids in the
   message); an unknown op; a hidden library id; a target "12 reps" on a strength item; a timed 3-set item with `restSec` 20;
   a server seeded with `fullState()` as is — it has an `activeWorkout` (`req-245.test.mjs:527`; C7's refusal text); `--out` already existing.
6. **Reads only:** the DB file's hash is unchanged after `plan build` (as req-245 AC1 checks preview).
7. `./check` green; test count rises by the new file's tests and no existing test is edited.
8. **Used at once:** Planner runs `plan build` + `plan preview` on a temp copy (the AC1 fixture) and pastes both outputs in
   the report; Coach's next plan run uses it instead of a script (its report says so).

## READY checks (2026-10-31)

1. DECs grepped (plan, coach, import, kg, superset, interval): DEC-096, DEC-128 §5, DEC-141, DEC-142, DEC-145 §4, DEC-146,
   DEC-147 (one user per run → `--user`), DEC-151. None conflicts.
2. Siblings: req-245 (shipped; `plan.mjs`/`ops-cli.mjs`, this reuses them unchanged). No open req touches `server/plan*`.
   **Order with the Phase 1 candidates:** supersets, interval chaining and cues-in-workout will add item fields — whichever
   ships after this extends `ITEM` + C4/C6 in the same req (noted in BACKLOG §Phase 1). Coach runs before this ships write a
   script as run 4 did (DEC-145 §4).
3. Deferral re-priced: none leaned on.
4. Numbers: line counts and library size measured above; 30 s = DEC-151.
5. Trigger files: none of check 5's (no store/model/storage/progress/workout-log edit; they are imported, not changed).
   No backup reminder (no stored record written). Planner runs a reviewer anyway: its output feeds a live-DB write.
6. User-visible calls: none — the app is unchanged and Emilio's steps are the same (`plan apply` asks him as before).

## Decisions made on Emilio's behalf (all implementation)

- A `plan build` subcommand reading the DB, not a script on an Export file: the base is exactly what preview compares to.
- JSON change list with stored field names; references by id / ref / exact name.
- `routine.items` is the whole list and keeps matched item ids; `item.set` for one-field edits.
- New item defaults = the app's `pickerItem`. C5 strict: kg only for exercises with history.
- Refuse vs warn split in C6 and §5 (Coach-facing; Planner can move a rule between them).
- `--out` never overwrites.
