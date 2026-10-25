**Status: READY** **Lane: data** (Emilio confirmed the mapping 2026-10-25; Planner reads the diff before the import)

# req-233 — link Emilio's exercises to the library, on a copy of his Export, before the server import

req-231 go-live. Emilio: "before you do, scan it, tell me any improvements … any exercises … what could be updated to actual
exercises instead of custom ones". Answers: "triceps, if its startrac, its a machine, same with leg curl, lying, its a fresh
export". Input: `/Users/emilio/dev/workout-database-2026-10-22.json` (exported 2026-10-22T09:59:38Z, outside git, DEC-068).

## Facts (rescanned 2026-10-25)

- The file has 50 exercises, 8 routines, 23 workouts, 571 sets, and `activeWorkout` null [measured: python scan in this session].
  9 exercises have a `libraryId`. 31 resolve by name through `libraryEntryFor` (`src/exerciseLibrary.js:588-595`: libraryId,
  then exact name, then alias). 10 resolve to nothing [measured: `node scan.mjs` in Planner's scratchpad].
- A `libraryId` drives the library entry used for:
  - rest cues and "one side" (`src/library-hints.js`)
  - assisted detection (`src/progress.js:116`)
  - template filters (`src/plan-templates.js:85`)
  - picker dedupe (`src/exercise-names.js:37-43`)
  
  The name stays the user's. `libraryId` is copied by the picker (`src/exerciseCatalog.js:234`) and kept by an edit
  (`src/exercise-names.js:87`).
- There is a precedent for a one-off fix on a COPY of an Export: `scripts/fill-routine-kg.mjs` (req-178). It runs
  `applyBackup`, has a dry run, and `--out` refuses to overwrite its input.

## Scope

1. `scripts/link-library-ids.mjs <export.json> [--out <copy.json>]`, shaped like `fill-routine-kg.mjs`. It only reads the
   input. It sets `libraryId` on the exercises below, matched by exact `name`. It asserts each name matches exactly one
   exercise and each id exists in `src/library/exercises.json` (not hidden, not merged), and refuses otherwise. It also sets
   `equipment` "Kettlebell" → "Kettlebells". It changes no other field.
2. **The mapping** (Emilio confirmed):
   - The 31 name-resolved exercises are linked to the entry `libraryEntryFor` gives them today, **except**:
     - `Biceps Curl` → `Machine_Bicep_Curl` (it resolves to `Dumbbell_Bicep_Curl`)
     - `Leg Curl` → `Lying_Leg_Curls` (it resolves to `Seated_Leg_Curl`)
   - The unresolved ones:

     | Exercise | libraryId |
     |---|---|
     | `Shoulder Press` | `Machine_Shoulder_Military_Press` |
     | `Triceps Press` | `Machine_Triceps_Extension` |
     | `Calf Raises (Leg Press)` | `Calf_Press_On_The_Leg_Press_Machine` |
     | `Pull-Ups (BW)` | `Pullups` |
     | `Dips (BW)` | `Dips_-_Chest_Version` |
     | `Kettlebell Bulgarian Split Squat` | `Split_Squat_with_Dumbbells` |
     | `Kettlebell Concentration Curl` | `Concentration_Curls` |
     | `Rask promenad / jogg` | `own-outdoor-walk` |

   - Unchanged: `Kettlebell Lunge Press`, `Löpning`, and the 9 already linked.
   - Write the mapping as a table in the script, keyed by name, with the library id. The 29 resolved-as-today rows are
     listed explicitly too, not computed, so a later library change can't move them.
3. The dry run prints for each exercise: the name, the old → new libraryId, the entry's shown name, `unilateral`, the
   equipment change, and the totals.
4. Run it on the file above and write the copy to `/Users/emilio/dev/workout/workout-database-2026-10-22-linked.json`
   (outside every worktree).

## Out of scope

- Renaming exercises, editing sets, weights or notes, or changing routines. This includes the 0 kg third set of Kettlebell
  Arnold Press in Johns Kettlebell Sesh: Emilio didn't ask for it to be changed.
- Changing the name resolver. Its wrong Biceps Curl match is a finding: put it in BACKLOG through the report.
- The import itself. Planner and Emilio do it, through the app's Import with "Replace everything" (DEC-134 §4).

## Acceptance criteria

1. Dry run, pasted: 39 libraryIds added (31 name-resolved, 2 of them to a different entry, + 8 unresolved), 3 equipment
   changes, 11 exercises untouched, 0 other changes.
2. The copy round-trips: `applyBackup(copy)` gives the same 50 / 8 / 23 / 571 as the input, and a field-level diff of input
   vs copy lists only `exercises[].libraryId` and `exercises[].equipment`. Paste the diff summary.
3. **Failure:** a mapping name that is missing, or matches twice, or a library id that doesn't exist → the script exits
   non-zero and writes nothing. Each has a test. `--out` equal to the input path → refused (test).
4. `./check` green.

## Decisions made on Emilio's behalf

- **Implementation:** a script on a copy, not an in-app migration (one user, one file, before the import). Mapping keyed by
  name for this one file.
- Behaviour, all confirmed by Emilio 2026-10-25: the mapping, and Kettlebells spelling.
