# req-180 — Add exercises to a routine: own first, whole library, multi-select

**Status: BUILT, NOT merged** (behaviour calls marked `(unconfirmed)` go on Emilio's end-of-batch list). **Lane: ui.** Source: DEC-097
§1–6 (req-144 prep §E.4: ~55 taps for a 5-exercise routine). Amends DESIGN §1 for one case (DEC-097 §4). Depends on
**req-179** (the routine item's fields after DEC-099); kg is today's history prefill (= DEC-096 §2), so it doesn't wait for
req-178 (held for Emilio, rebased last); **req-181** builds on this picker.

## Today [read 2026-09-26, main `1e228c0`]
- **Picker** `RoutineExercisePick` (`views/Routine.jsx:246-289`): own non-archived exercises only, substring match on
  `name equipment muscles` (`:257-262`), in store order; one tap → `nav.newItem(id)` → the per-exercise form. No own
  exercises → "None." (`:273`). Shared by four flows — routine, schedule slot, workout setup, history recalc
  (`views/routine-nav.js:1-3`, `Routine.jsx:504`).
- **Per-exercise form** `RoutineExerciseNew` (`Routine.jsx:405-449`): values from `historyPrescription`
  (`history-queries.js:211-236`: sets, targets, suggestedWeights (only if some kg > 0), restSec from the snapshot item,
  notes, warmup); no history → rest/sets blank; role `warmup` for a cardio type (`:412`).
- **Library search** lives only in `ExerciseNewSearch` (`views/Exercises.jsx:270-358`): `searchCommonFirst` staples
  first, "Show N more" (`:295-297`, `:350-354`); live match → "Add to routine", archived → Restore (DEC-059 §3), else
  `store.addExercise(catalogItemToExercise(item))` (`:340`).
- **Empty query returns nothing** [measured, scratchpad script → `searchCommonFirst(cat, '')`]:
  `empty query: 0 0 0`. Listable staples: `194`, by `muscleGroups`:
  `{"Core":26,"Shoulders":21,"Legs":72,"Back":36,"Chest":24,"Arms":35}`; 20 staples sit in >1 group, 0 in none.
  Group order is `MUSCLE_GROUPS` (`exerciseLibrary.js:57`).
- **Bug (DEC-097 §6)** — `catalogItemToExercise` (`exerciseCatalog.js:155-171`) never reads `logAs` [measured]:
  `plank logAs time -> {"name":"Plank","type":"bodyweight",...}` — no `hasDuration`, so Plank is untimed.
  Across listable entries [measured]: `time->bodyweight: 35`, `weight-time->free: 6`, `cardio->free: 1` (one cardio
  entry becomes a non-cardio type), `cardio->cardio: 12`.
- **Near-duplicates** — `libraryItemMatch` (`exercise-names.js:40-58`) is libraryId / exact name only; "Bench" never
  matches "Bench Press".
- **Timed items:** `DEFAULT_DURATION_SEC = 30` (`set-rules.js:11`); routine items carry per-set `durations`
  (`model.js:62`, `routine-item-parse.js:113`).
- **Rule text** forbidding an invented rest: `.cursor/rules/history-prefill.mdc:17` ("Do not invent … rest (90s)").

## Change
1. **Picker, one screen, one search field.** Top: your exercises (non-archived), **most recently done first** — ordered by
   the newest finished workout containing them (`finishedNewestFirst`, `history-queries.js:162`); never-done ones after,
   A→Z `(unconfirmed)`. Below: the bundled library via `searchCommonFirst` (staples, then "Show N more"), minus rows
   whose `libraryItemMatch` is **live** (that exercise already shows above). No pinning. Own-list search keeps today's
   substring rule.
2. **Empty search:** your list (if any), then **staples grouped by muscle**, groups in `MUSCLE_GROUPS` order; a
   multi-group staple listed under its first group only `(unconfirmed)`.
3. **Multi-select:** tapping a row toggles it; a primary **"Add N"** (right side, DESIGN §4) adds all selected, in tap
   order `(unconfirmed)`, and returns to `nav.base`. N=0 → the button is disabled. "Create exercise" link stays.
4. **Picking a library entry** creates the own record (`store.addExercise(catalogItemToExercise(item))`) at **Add N**,
   not at the tap — backing out creates nothing.
5. **Values per added item** — a pure helper (unit-tested), one source per item, never mixed:
   - **history** (`historyPrescription` non-null): the whole prescription — sets, targets, rest, notes, and kg from the
     source req-178 names (DEC-096 §2). Same fields `RoutineExerciseNew` writes after req-179 (warm-up/role per DEC-099).
     A history field that is absent stays absent — no starting-plan value is mixed in `(unconfirmed)`.
   - **starting plan** (no history), by logging kind, **never a kg** (`suggestedWeights: []`):
     reps → 3 sets × 10, rest 90 s; timed (`hasDuration`) → 3 sets × the exercise's `durationSec` (default 30), rest
     90 s `(unconfirmed: 3 sets, 90 s)`; cardio type → 1 set, no target, rest 0 `(unconfirmed)`.
   - **Shown, not silent:** a selected row shows its plan under the name — "Starting plan: 3 × 10, 90 s rest — change
     any time" (DEC-097 §4 wording) or the history plan, e.g. "Last time: 3 × 8 · 60 kg" `(unconfirmed: placement on
     the selected row; history wording)`.
6. **Near-duplicate guard:** tapping a library row that loosely matches one of your exercises — every word of the
   shorter name is in the longer (case/punctuation-insensitive), or an exact/archived `libraryItemMatch` — asks
   **"Use your 'Bench'?"** inline, with three outcomes: use yours (select it; an archived one is Restored, same id,
   DEC-059 §3), add the library entry as new, or back out `(unconfirmed: inline, not the confirm sheet — askConfirm has
   only two outcomes, `ui/confirm.js:17`)`. Live matches outrank archived; among several, the most recently done.
7. **Fix `catalogItemToExercise`:** `logAs` `time`/`weight-time` → `hasDuration: true`; `cardio` → `type: 'cardio'`.
   Applies to Library Search's Add too (same function, `Exercises.jsx:340`).
8. **Rule text:** Builder updates `.cursor/rules/history-prefill.mdc:17` to name the starting-plan exception (on top of
   req-178's rewrite). DESIGN §1 is Planner's to amend at closeout (Builder can't write `handoff/`).

## Out of scope
- Starter/slot templates and filtering the picker by slot pattern (req-181 — it reuses this picker; keep it a
  component taking its list/filters as props).
- Changing `searchCommonFirst` ranking, `libraryItemMatch`, or Library Search's own screen beyond the step-7 fix.
- `bodyweight-reps->free` (31) / `weight-reps->bodyweight` (1) type inference — separate library question.
- Excluding exercises already in the routine (today's picker allows it; unchanged).
- Rewriting existing exercises' `hasDuration` (no bulk write — only records created from now on).
- The per-exercise form `RoutineExerciseNew` stays for "Create exercise" and Search's "Add to routine" paths.

## Steps
1. Branch from main after req-179 merges (req-178 is held for Emilio; it rebases onto this). kg source today: the history prefill `RoutineExerciseNew` already uses (`Routine.jsx:410-417`) — DEC-096 §2 is that same rule, so no wait on 178.
2. Fix `catalogItemToExercise` + test (fails on main: Plank → no `hasDuration`).
3. New pure module (e.g. `src/routine-picker.js`): `ownRecentFirst(exercises, workouts)`, `staplesByMuscle(catalog)`,
   `looseOwnMatch(exercises, item)`, `pickerItem(workouts, exercise)` → `{ source: 'history'|'starting', item, label }`.
   Unit tests for each.
4. Rewrite `RoutineExercisePick` on those helpers; catalog loads lazily (`loadExerciseCatalog`) — own list renders
   before it and without it.
5. Update the `.mdc`; `./check`; report with the test list.

## Acceptance criteria
1. **Bug, fails on main:** `catalogItemToExercise(Plank)` → `hasDuration: true`; the one `cardio` entry typed `free`
   today → `type: 'cardio'`; a `weight-reps` entry → no `hasDuration` (test; paste main + branch output).
2. `ownRecentFirst`: A done yesterday, B done last week, C never → A, B, C; archived excluded (test).
3. `staplesByMuscle(catalog)` → 6 groups in `MUSCLE_GROUPS` order, 194 rows total, no staple twice (test).
4. **Is the right mechanism answering?** `pickerItem` for an exercise with history 4 × 6 @ 80 kg, rest 120 →
   `source: 'history'` and fields deep-equal `historyPrescription`'s (assert against the function, not a hand copy); for
   a history whose rest is absent → rest absent, `source` still `'history'` (no 90 injected).
5. **Empty input — no history:** reps → `{sets:3, targets:['10','10','10'], restSec:90, suggestedWeights:[]}`;
   timed (durationSec 45) → 3 × 45 s durations; cardio → 1 set, rest 0. **No kg in any starting plan** (test).
6. `looseOwnMatch`: own "Bench" vs "Bench Press" → match; own archived "Bench Press" → archived match; own "Row" vs
   "Bench Press" → null; live beats archived (test).
7. **Remove a dependency:** catalog load fails (`loadExerciseCatalog` rejects) → own list, selection and Add N still
   work; the library part shows "Could not load." (browser, Planner: block the chunk or stub).
8. Browser (`plan qa`): fresh store → Add exercise shows staples by muscle; select Bench Press + Plank + Rowing → "Add 3"
   → routine has 3 items; read `workout-mvp-v9`: 3 new exercises with `libraryId`, Plank `hasDuration: true`, items
   3×10/90 s, 3×30 s, 1 set; no `suggestedWeights` > 0.
9. Browser: own "Bench" exists → tap library "Bench Press" → "Use your 'Bench'?" → use yours → no new exercise record.
10. Browser: back out of the picker with 2 selected → no exercise or routine item created.
11. `./check --smoke` green.

## Decisions
**Implementation (Planner, reversible):** helpers in a new `src/routine-picker.js`; the own record is created at Add N,
not on tap; multi-add uses existing `store.addExercise` / `store.addRoutineExercise` per item (no `store.jsx` change
expected); loose match = word-subset on normalized names.
**Behaviour `(unconfirmed)`:** never-done own exercises A→Z; multi-group staple under first group only; tap-order add;
no mixing history + starting plan; timed start 3 sets / 90 s; cardio start 1 set, no target, rest 0; plan line on the
selected row + history wording; inline three-way guard.

## READY checks
1. DECs grepped: DEC-096, 097, 098, 099, 059 §3 (Restore), 064 §2–3, 066 (staple), 012 (no-history calibration still
   applies — the starting plan has no kg). No conflict.
2. Siblings, build order (Planner 2026-09-26): 179 → **180** → 181, 178 held and rebased last. 178/179/180 all edit `Routine.jsx`; 181 consumes this picker.
3. Deferral: bodyweight-type inference (32 entries) stays deferred — same size later, no data depends on it.
4. Numbers: 194 / group counts / logAs→type counts measured above; 3 × 10 / 90 s from DEC-097 §4; 30 s from `set-rules.js:11`.
5. Trigger files: none expected (`exerciseCatalog.js`, `Routine.jsx`, new module). **If Builder edits `store.jsx`,
   `model.js`, `storage.js`, `workout-log.js` or `progress.js`, the independent reviewer runs.** No
   migration, no bulk write (only new records via the normal UI path) → no ask-gate #2, no backup reminder.
6. Every visible call above is marked `(unconfirmed)`.
