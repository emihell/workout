**Status: READY** · **Lane: tooling** · audit 2026-10-30 F-DEAD-7/F-DEAD-8/F-STRUCT-9, audit 09-12 F-DEAD-2, req-164 (the shim), req-165 (F-DEAD-5, the kept-for-tests rule), DEC-155. After req-261 (both edit `src/views/set-values.js`) and req-262; before req-270.

# req-269 — remove the storage.js shim, test-only exports, a duplicated predicate and unused @types

## Why (observed) [measured, `main` `78d6bc9`, 2026-10-31]

Lane = tooling: no user-visible behaviour, a pure removal; the failure it fixes is dead code that three audits found and
that tests keep alive. Not bug lane: nothing renders wrong.

1. **`src/storage.js` shim** (F-DEAD-8): 4 lines of re-exports, its header says "for one release" (req-164, 2026-09-25).
   `grep -rlE "storage(\.js)?['\"]" src server scripts`: **0 app importers; 24 test files + 2 scripts**:
   `no-invented-plan, req-116, req-119, req-124, req-127, req-128, req-152, req-157, req-158, req-161, req-163, req-164,
   req-165, req-168.import, req-193, req-211, req-220.real-path, req-220, req-225, safe-import, skip-replace, storage,
   workout-log, workout-note` (`.test.js`) and `scripts/req-164-golden.mjs:25`, `scripts/req-165-golden.mjs:24`.
2. **Test-only exports** (F-DEAD-7) — no non-test reader, no use in their own file (`grep -rlw <name> src server scripts`):
   | export | file | test files | call |
   |---|---|---|---|
   | `offerText` | `routine-update-offer.js:57` | 2 | delete + its assertions |
   | `historyGroupRowMeta` | `views/history/helpers.js` | 2 | delete (`req-152.test.js:89` says it was replaced) |
   | `swapOn` | `schedule.js:127` | 1 | delete; `swapsOn` stays (the real reader) |
   | `sumDays`, `exportAnalytics` | `analytics.js:135,186` | 2 | delete, **or** keep with a header comment if they are the analytics tests' read path (the req-165 F-DEAD-5 "exported for tests" rule) — builder decides from `analytics.test.js`, states why |
   | `searchExerciseCatalog` | `exerciseCatalog.js:109` | 5 | **keep** — documented exception (`:106-108`) |
   `lastLoggedSetIndex` (`workout-log.js:468`, 1 test) is also test-only → handled in **req-270** (same file). `activeSetPatch`
   → **req-261**.
3. **`sameKind` defined twice** (F-STRUCT-9): `src/views/set-values.js` `viewedSetSave` (`:66-69`) and `skippedSetSave`
   (`:93-96`), byte-identical bodies; both comments say they must agree.
4. **Unused `@types/react`, `@types/react-dom`** (`package.json:24-25`, 09-12 F-DEAD-2, open for the third audit): no
   `tsconfig`/`jsconfig` in the repo; `grep -rn '@types' src scripts server vite.config.js` → nothing.

## Scope

1. Move every `storage.js` import in the 24 test files to the owning module (`persistence.js`, `history-queries.js`,
   `state-reducers.js`, `model.js`) and delete `src/storage.js`.
2. The two golden scripts record **any** tree, including trees from before req-164: make them import `persistence.js` when
   the tree has it, else `storage.js` (one `existsSync` line). `src/req-164.golden.json.gz` is not re-recorded.
3. Delete the test-only exports per the table, with the tests that only test them.
4. One `sameKind(set)` helper (module-private) used by both functions.
5. Remove both `@types/*` from `package.json` + `package-lock.json` (`npm uninstall`).
6. Fix `set-values.js:2-3`'s stale caller list if req-261 didn't.

## Out of scope

- `activeSetPatch` (req-261), `lastLoggedSetIndex` and any `workout-log.js` change (req-270).
- `searchExerciseCatalog` (kept, documented).
- Any behaviour change; any new export.

## Steps

1. Branch from `main` **after req-261 and req-262 are merged**. Re-run the grep receipts above (the counts may have moved).
2. Shim: move imports file by file (import lines only), run that file, then delete `storage.js`.
3. Exports, `sameKind`, `@types`, each its own commit.
4. `./check`; the golden test (`src/req-164.test.js`) still passes; record each golden script once against `main` to show
   it still runs on an old tree (`git archive` copy, L-040).

## Acceptance criteria

1. `src/storage.js` is gone; `grep -rlE "storage(\.js)?['\"]" src server scripts` lists only the golden scripts' fallback.
2. **Test edits called out:** a table per test file — import path moves only, or a deleted test with the export it
   covered. **No remaining assertion changes value.** Test count before → after, and the difference = the deleted tests
   (count them; L-067: compare the count, not only green).
3. Each deleted export: `grep -rlw <name> src server scripts` → nothing.
4. **Failure case — the fallback works:** `scripts/req-164-golden.mjs` run on a pre-req-164 tree (`git archive b78e73d`,
   which has no `persistence.js`) still records; on the branch tree it records via `persistence.js`. Both receipts.
5. `sameKind` defined once (`grep -c 'const sameKind\|function sameKind' src/views/set-values.js` → 1); req-212/req-241's
   tests for `viewedSetSave`/`skippedSetSave` pass unedited.
6. `@types/*` gone from `package.json` and the lock; `npm ci && ./check` green; build size unchanged (state both).
7. `./check --smoke` green.

## Decisions made on Emilio's behalf

All implementation: which exports go (the table), the golden-script fallback, `sumDays`/`exportAnalytics` by the req-165
rule. Nothing a user sees.

## Siblings

req-261 deletes `activeSetPatch` in `set-values.js` (first). req-262 edits `workout-log.js`/`model.js` (first). req-270
splits `workout-log.js` (after this). No reviewer trigger file is edited except imports in tests [check on the branch:
if the diff touches `store.jsx`, `model.js`, `storage.js` (deleting it counts — WORKFLOW check 5 lists it), `progress.js`
or `workout-log.js`, the independent reviewer runs]. **Deleting `storage.js` is a trigger → reviewer.** No stored data
changes → no backup reminder.
