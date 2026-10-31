**Status: BUILT AND MERGED, 2026-10-31 — branch `req-276` (`778fb07`…`12ef75c`, 18 commits).** · **Lane: tooling** (refactor, no behaviour change) · audit 2026-10-30 F-STRUCT-8 (candidates), req-270 (method), req-164, DEC-155 §7. **After req-264 and req-265** (both edit `src/views/workout/item.jsx` / `src/ui/`); re-measure on the main they leave.

# req-276 — split `item.jsx` and `ui/index.jsx` by job; `workout-log.test.js` follows req-270's modules

## Why (measured on `main` `5798ae2`, 2026-10-31)

| File | Lines | Exports | Top-level decls | Importers |
|---|---|---|---|---|
| `src/views/workout/item.jsx` | 993 | 3 | 15 (12 private) | 1 app (`views/workout/index.jsx`), 28 tests via `importJsx`, 5 source reads |
| `src/ui/index.jsx` | 1,003 | 24 | 29 (5 private: `cx`, `DurationTimer`, `CardioFields`, `secondsNow`, `EMPTY_CARDIO`) | 25 app modules, 19 test files read its source |
| `src/workout-log.test.js` | 957 | — | 13 `describe`, 78 `it` | names a module deleted in req-270 |

Commands: `wc -l`, `grep -cE '^export '`, `grep -nE '^(export )?(function|const) '`, `grep -l "views/workout/item" src/*.test.js`
(33 files: 28 `importJsx('./views/workout/item.jsx')`, 2 `readFileSync`, 2 `read(…)` pins). `WorkoutItemLive`
(`item.jsx:298-783`, 485 lines) is one component — a move can't shrink it.

## Scope — proposed boundaries (builder re-measures after req-264/265 and states any change)

**`src/views/workout/`** (item.jsx keeps the screens that `index.jsx` routes to):
| New file | Moves | Count |
|---|---|---|
| `item.jsx` (stays) | `WorkoutItemLog`, `WorkoutItemLive`, `WorkoutSetEdit` | 3 |
| `item-actions.js` | `liveExercise`, `exerciseEditorPath`, `markDoneAndGoToReview`, `askRoutineUpdate`, `markNextArrival`, `useSetDraftWriter` | 6 |
| `item-header.jsx` | `ExerciseTitle`, `ExerciseSetupHeader` | 2 |
| `up-next-bar.jsx` | `UpNextBar` | 1 |
| `logged-set-sheet.jsx` | `LoggedSetSheet` | 1 |
| `review.jsx` | `WorkoutItemDone` (export), `ExerciseReview` | 2 |

**`src/ui/`** (`ui/workout-pill.js` already exists for pill logic — don't collide):
| New file | Moves | Count |
|---|---|---|
| `cx.js` | `cx` | 1 |
| `controls.jsx` | `Button`, `NavLink`, `Actions`, `SegmentedControl`, `Checkbox`, `FileButton` | 6 |
| `fields.jsx` | `Field`, `SearchField`, `NumberField`, `Textarea`, `Select` | 5 |
| `layout.jsx` | `Screen`, `Title`, `SectionHeader`, `List`, `Row`, `Banner` | 6 |
| `confirm-sheet.jsx` | `ConfirmSheet` | 1 |
| `pill.jsx` | `WorkoutPill` | 1 |
| `set-log-form.jsx` | `SetLogForm` + private `DurationTimer`, `CardioFields`, `secondsNow`, `EMPTY_CARDIO` | 5 |
| `sets.jsx` | `ExerciseHead`, `RestNotes`, `SetList`, `SetEditSheet` | 4 |
| `index.jsx` | `export … from` each file — **kept as the component library's public entry** (DEC-017), not a shim | 0 bodies |

**`src/workout-log.test.js`** → split by the module each `describe` tests (`workout-items.test.js`, `set-seed.test.js`, …),
or renamed if one module dominates; test bodies unchanged.

Method (req-270): every moved body byte-identical; every importer re-pointed (app imports of `ui` may stay on
`ui/index.jsx`); the 5 + 19 source-reading tests change only the path they read, same regex; `check-cycles` green; each new
module loads alone.

## Out of scope

- Splitting inside `WorkoutItemLive` or `SetLogForm` (body changes, not moves) — note candidates in the report.
- Any behaviour, copy or CSS change. `ui.css` stays one file.

## Steps

1. Re-measure on post-req-265 main; adjust the tables. 2. One commit per new file, `./check` green each. 3. Re-point tests.
4. Split/rename `workout-log.test.js`. 5. Equivalence + load + cycle checks; smoke; `plan qa` browser pass of the log screen.

## Acceptance criteria

1. **Bodies identical:** a script compares every top-level declaration of main's `item.jsx` + `ui/index.jsx` with the new
   files (source with `export ` stripped): all identical, none duplicated, none new.
2. **Imports resolve:** every named import in `src scripts server` resolves to a module that exports it: 0 unresolved.
3. **Each module loads alone** in a fresh node process (JSX via the repo's test loader), no undefined export.
4. **Failure case — cycle:** add an import from `controls.jsx` into `cx.js` in a probe → `./check` red naming the cycle;
   reverted, not committed.
5. **Test count unchanged** with `./check`'s file set (or each difference named); every test edit is a path/import line.
6. `./check --smoke` green; one `plan qa` walk of a workout (log a set, rest, review) with 0 dialogs / page errors.

## Decisions made on Emilio's behalf

- Implementation only: file boundaries and names; `ui/index.jsx` stays as the library's entry (re-exports), unlike
  req-270's no-shim rule, because 25 importers use it as a public API rather than a transitional alias.

## Reviewer

No trigger file is touched (`plan:898` REVIEWER_TRIGGER_RE names neither `item.jsx` nor `ui/`). Planner runs the independent
reviewer anyway for the equivalence claim (2k lines moved), as for req-270.

## Siblings

req-264 (ui fixes: `Routine.jsx`, import sheet in `ui/`), req-265 (`item.jsx` library hook) land first.
