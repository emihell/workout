# req-19 — split the two oversized view files into per-screen folders

## Technical

`src/views/Workout.jsx` (827 lines) → `src/views/workout/` and
`src/views/History.jsx` (624) → `src/views/history/`. Pure move: no function body
changed (proven below). Importer strategy: **a barrel `index.jsx` per folder**
re-exporting exactly the screens `App.jsx` imports; `App.jsx`'s two import lines
change only `./views/Workout` → `./views/workout` and `./views/History` →
`./views/history`. (The folder rename forces that even on case-insensitive macOS,
because the old path would be ambiguous on case-sensitive CI once a folder exists.)

### Split boundaries (my call)

**`views/workout/`** (7 files):
| file | lines | contents |
|---|---|---|
| `helpers.jsx` | 42 | cross-module helpers: `exerciseName`, `findItem`, `isActiveFor`, `MissingItem`, and the path family `itemLogPath`/`itemDonePath`/`itemCurrentPath`/`itemSetsPath` |
| `rest.jsx` | 71 | `useRestCountdown` + `RestBar` (shared by every in-workout screen) |
| `overview.jsx` | 139 | `Workout`, `WorkoutItem` (+ local `abandonWorkout`) |
| `item.jsx` | 397 | `WorkoutItemLog`, `WorkoutItemLive`, `WorkoutItemDone`, `WorkoutSetEdit` (+ their single-use locals: `liveExercise`, `ExerciseTitle`, `ExerciseSetupHeader`, `exerciseEditorPath`, `carryFor`, `restoreFromLoggedSet`, `usesWeight`, `isDurationTarget`, `setProgressLabel`, `markDoneAndGoToOverview`) |
| `setup.jsx` | 104 | `WorkoutItemExercise`, `WorkoutSetup` |
| `finish.jsx` | 114 | `WorkoutFinish` + `FinishScreen` |
| `index.jsx` | 6 | barrel |

**`views/history/`** (6 files):
| file | lines | contents |
|---|---|---|
| `helpers.js` | 141 | `itemIdOf`, `workoutRoutineId/Name`, `routineTitle`, date helpers (`workoutDateKey`, `compactDate`, `whenLabel`, `sortWorkoutsByDate`), grouping (`monthLabel`, `groupWorkoutsByMonth`; `workoutMonthKey` stays internal), and `addSetToWorkout` — pure, no JSX, so `.js` |
| `list.jsx` | 120 | `History`, `HistoryExercises`, `HistoryExercise` (+ local `WorkoutHistoryRow`) |
| `detail.jsx` | 155 | `HistoryDetail`, `HistoryWorkoutExercise` |
| `edit.jsx` | 167 | `HistoryEdit`, `HistorySetNew`, `HistorySet` |
| `recalc.jsx` | 64 | `HistoryRecalculate`, `HistoryRoutine` |
| `index.jsx` | 6 | barrel |

Principle: a helper used by only one module stays **local** to it (no export); only
symbols used by ≥2 modules went into `helpers`. That keeps the cross-module surface
small (workout: 10 shared symbols; history: 11) and single-use logic co-located.

### Guard against the domino effect

`App.jsx` is the **only** external importer of these screens (the split changes no
route strings, no `route.js`, no tests). The barrels export exactly the 8 workout +
10 history names `App.jsx` imports; `WorkoutItemLive` stays internal to `item.jsx`.
Build-green confirms every barrel re-export and every `App.jsx` name resolves (a
missing named re-export fails the esbuild build).

**Important — the gate does not catch a missing import of a *local* helper.** I
verified: `oxlint` does not flag undefined identifiers (tested with a probe), and
esbuild treats a bare undefined identifier as a global (no build error) — such a
bug would surface only as a runtime blank screen. So I ran explicit audits below
rather than trusting `./check` alone.

### Receipts

**Pure move — function bodies byte-identical.** Stripping import lines, `export `
prefixes, comments and blanks from the old files and from the union of the new
modules, then diffing the sorted remainder:

```
=== WORKOUT bodies ===  WORKOUT BODY LINES IDENTICAL
=== HISTORY bodies ===  HISTORY BODY LINES IDENTICAL
```

The only lines that differ before that final strip were **import specifiers**
(redistributed across modules, and duplicated where two modules import the same
helper) — no body line differs. Spot-check diffs of three representative functions
(`WorkoutItemLive`, `FinishScreen`, `HistorySetNew`) against `main`: all `IDENTICAL`.

**Every reference resolves** (three audits, all clean):
- internal moved symbols used-but-not-defined-or-imported: none in workout/, none in history/;
- JSX component tags (`<Xxx>`) not imported/defined: none;
- external helpers (ids/storage/route/workout-log/…) used-but-not-imported: none;
- unused imports: none.

**No stale references** — `grep -rn "views/Workout\|views/History" src` → `(none)`;
`App.jsx` imports `./views/workout` and `./views/history`.

**`./check`:**

```
check: green — lint, 13 test file(s), and the build all passed.
```

All 105 tests pass with no test edits (the split touches no code they import by the
old path — tests import model/log/storage modules, not the view screens).

## Workflow

No deviation from scope: `git mv`-shaped move, no logic/route/signature change. The
diff shows moved lines plus added import/export lines only.

Choices the spec left to me, and made:
- **barrel re-export** (not rewritten import paths at many sites) — there's only one
  importer (`App.jsx`), so a barrel keeps its imports a single clean line each and
  isolates the folder layout from the rest of the app.
- **helpers placement**: shared-only in `helpers`; single-use helpers left local to
  their screen module. `addSetToWorkout` went to history `helpers.js` (two callers).
  `RestBar`/`useRestCountdown` in their own `rest.jsx` (used by four screens).
- **history `helpers.js` is `.js`** (no JSX in it); everything else `.jsx`.

Flagging one thing for the planning session: the lint/build gate's blind spot to
undefined identifiers (above) means a future by-hand split like this can't lean on
`./check` for reference-resolution — worth an `L-` so the next such refactor runs an
explicit audit. I verified this one by the three audits + body-diff above, but the
real proof is the browser walk you flagged you'd do.

Could not verify myself (needs a browser — planning's gate, and you called this the
highest regression-risk one): walking the routes that hit these files — Today →
Start → live Workout (overview / log a set / rest / done / finish) and History
(list / month / a finished workout / edit a set) — every screen renders, no blank
screen, no 404. The audits above are why I expect them all to render; they are not a
substitute for the walk.
