**Status: READY** · **Lane: tooling** (a pure refactor, as req-164) · audit 2026-10-30 F-STRUCT-8, req-164 (the pattern), DEC-155. After req-261, req-262 (both edit `workout-log.js`) and req-269. Touches `workout-log.js` → **independent reviewer** (WORKFLOW check 5).

# req-270 — split `workout-log.js` by job

## Why (observed) [measured, `main` `78d6bc9`, 2026-10-31]

`wc -l src/workout-log.js` → **1,232** (784 at the 09-24 audit); `grep -c '^export'` → **71**; importers
(`grep -rlE "workout-log(\.js)?['\"]"`): **27 app modules + 2 scripts, 35 test files**. Every Phase-1 req lands in it
(req-261, req-262 this batch). Same shape as 09-24 F-STRUCT-6 (`storage.js`), which req-164 split.

## Proposed boundaries — from the real exports (builder adjusts after reading the bodies; say why)

| new module | job | exports (count) |
|---|---|---|
| `workout-items.js` | edits to a workout's items and sets | `itemKey setsForItem workCountFor addedSetCount withOneMoreSet withOneLessSet canRemoveAddedSet removeAddedSetPatch addWorkingSetToState withSkippedUnloggedSets skipItemPatch replacementItem sessionExercise replaceItemPatch appendItemPatch markItemDonePatch reopenItemPatch withLoggedSet itemEffortSets withItemEffort itemEffort` (21) |
| `workout-progress.js` | where the workout stands | `itemAllSkipped itemLoggingState itemIsMarkedDone allItemsDone loggedSetCount anythingLogged autoCompleteArmed endedOnSkip nextNotDoneItem currentWorkoutItem itemSetPosition itemSwappedAway workoutPosition workoutPillState` (14) |
| `workout-finish.js` | finishing | `lastSetAt LEFT_OPEN_MS finishTimeFor finishedState` (4) |
| `set-seed.js` | what a set is prefilled with (the prefill rule, CLAUDE.md) | `carriedWorkingSet carryForSet setupSeedFor restoreFromLoggedSet setLogSeed uniformRepsTargets seedOverrideKey nextSeedOverrides initialSetFields setTargetFor routineKgFor durationTargetFor` (12) |
| `set-drafts.js` | unsaved set drafts | `setDraftKey setDraftFor setDraftFromForm setDraftFromLoggedSet formFieldsWithDraft DRAFT_WRITE_MS createSetDraftWriter` (7) |
| `set-display.js` | set text and rows | `setPreview setPreviewText setListRows loggedSetRowText eachSideReps restClockText` (6) |
| `workout-timers.js` | stopwatch + rest | `stopwatchFor stopwatchOwner startStopwatchPatch restPatchAfterSet restRemaining` (5) |

69 in the table + `lastLoggedSetIndex` = 70 named, + the `isAddedMidWorkout, isSkippedSet` re-export line from
`set-rules.js` (`:7`) = 71. **`lastLoggedSetIndex`**
(`:468`, test-only, audit F-DEAD-7) is deleted, not moved. Re-measure after req-261/262: they add/change exports.

## Scope

1. Move code **verbatim** into the modules above (or the builder's adjusted cut). Private helpers go with their only user;
   one used by two modules goes to the lower one.
2. **No shim.** All 27 app importers, 2 scripts and 35 test files import the owning module directly (import lines only).
   req-164 kept `storage.js` "for one release" and it outlived it by five weeks (F-DEAD-8, req-269) — don't repeat it.
   `isAddedMidWorkout`/`isSkippedSet` importers move to `set-rules.js`.
3. `workout-log.js` is deleted at the end.

**Reviewer trigger (req-269 review):** every new module split out of `workout-log.js` is added to `plan`'s
`REVIEWER_TRIGGER_RE` (`plan:856`), with a `scripts/plan-ledger.test.sh` assertion per name; Planner updates WORKFLOW check 5.

## Out of scope

- Any behaviour change, renamed export, or new export.
- `views/workout/item.jsx` (988 lines) and `ui/index.jsx` (1,003 lines) — the view-side candidates (audit F-STRUCT-8);
  BACKLOG lines, not this req.

## Steps

1. Branch from `main` after req-261, req-262, req-269. Re-measure lines/exports/importers.
2. Safety net first: `src/req-164.test.js`'s golden (migrate, load, save→load, `finishedState`) passes before and after
   every commit; `scripts/req-164-golden.mjs` imports `finishedState` — give it the same "new module else old" fallback
   req-269 adds for `storage.js`.
3. One module per commit, each green (`./check`, `scripts/check-cycles.mjs`).
4. Line-multiset comparison like req-164: code lines before = after (minus `lastLoggedSetIndex`), 0 added.

## Acceptance criteria

1. `src/workout-log.js` does not exist; `grep -rlE "workout-log(\.js)?['\"]" src server scripts` → only the golden
   script's fallback.
2. **Verbatim:** the line-multiset receipt — N code lines before, N − (lastLoggedSetIndex's lines) after, 0 added.
3. **Failure case — a cycle:** `scripts/check-cycles.mjs` green on every commit; plus a probe (a temp import from a new
   module back to one that imports it) → `./check` RED naming the cycle. Probe not committed.
4. **Failure case — nothing dropped:** test count before = after (L-067), `src/req-164.test.js` deep-equal passes.
5. Test edits: import lines only — the diff of every `*.test.js` is `import` lines (a `git diff -U0` filter as the
   receipt); none changes an assertion.
6. `./check --smoke` green; `plan qa` smoke on the branch build green (the log screen is the most-used view).
7. Main bundle gzip before/after stated (expect ±0).

## Decisions made on Emilio's behalf

Implementation only: module names and cut, no shim, `lastLoggedSetIndex` deleted. Nothing a user sees.

## Siblings

req-261, req-262 (first — same file). req-269 (first — removes the `storage.js` shim; this req reuses its golden-script
fallback). req-265 edits `views/workout/item.jsx` imports — if it merges first, its imports move here too. Reviewer:
yes (`workout-log.js`). Backup reminder: no (no stored data written).
