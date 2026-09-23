# req-115 — a bad import shows an error instead of blanking the app (audit D)

**Status: SPEC — READY, held for Emilio's go.** Phase 1. **[functional]** + **[P]**: touches `store.jsx`,
`storage.js` and the import path (DEC-057: reviewer + backup reminder before merge).

## Why [measured, scratchpad/audit-history/import-test.mjs]

`store.applyBackup` (`store.jsx:379-386`) calls `applyBackupFn` **inside** the `setState` updater. React swallows
the throw and re-runs the updater during render, where it throws inside `StoreProvider`, above the only
ErrorBoundary (`App.jsx:231-238`). The whole tree unmounts: `after render tree: null`. Settings' try/catch never
fires. Stored data survives. It's reachable by picking the wrong JSON, e.g. the analytics export from the same
screen, or a backup whose nested collections are malformed (`workouts:[null]`, `workout.sets:"x"`, … all throw in
`migrateState`). Nit: a v9 value that parses to a non-object (e.g. a string) is spread, overwritten, and the legacy
v8 key deleted (`storage.js:169-178`).

## The behaviour

1. `store.applyBackup` runs `applyBackupFn` **before** `setState`. On success it sets the state; on failure it
   throws to the caller, whose existing error message shows. Nothing changes.
2. **Validate recursively at unwrap:** every element of every collection must be a plain object
   (`workouts`, `exercises`, `routines`, `routines[].exercises`, `workouts[].sets`, snapshot `items`,
   `schedule.slots`, `plannedWorkouts[].items`); nested collections must be arrays; `activeWorkout` must be null
   or a plain object. A failure is a clear "Not a valid backup" error. (The review found `[null]` elements that
   pass `migrateState` but crash render, which would then show the error boundary on every load.)
3. A v9 value that parses to a non-plain-object is **unreadable** (the DEC-032 path: never overwritten, banner
   shown), not spread.
4. Last resort: an ErrorBoundary **above** `StoreProvider`, so no render throw leaves a blank page.

## Scope

`store.jsx`, `exchange.js`/`import-backup.js` (validation), `storage.js` (non-object guard), `App.jsx`/`main.jsx`
(outer boundary), tests. The import step is a **pure `.js` function** unit-tested under `./check`; the whole-tree check
runs in puppeteer (tests can't import `.jsx`).

## Order vs siblings

**First** of the Tier 1 batch: 114 and 120 edit `storage.js` / `exchange.js` after it.

## Acceptance criteria

- **Failure case (unit, the pure import step):** the analytics export, `{workouts:[null]}`, `routines[0].exercises:[null]`,
  `schedule.slots:[null]` and `activeWorkout: 42` each → a "Not a valid backup" error, with state unchanged.
- **Failure case (puppeteer):** import the analytics export in Settings → an error message shows and the app still
  renders.
- **Success (unit):** a valid backup imports as before, and round-trips deep-equal.
- **Non-object v9 (unit):** v9 = `"x"`, `[1,2]` or `42` plus a v8 key → unreadable is latched and the v8 key is still
  present (measured today: v8 deleted).
- **No regression:** `./check` green; all migration tests unchanged. Receipt quoted.

## Decisions

- An outer ErrorBoundary as a last resort. Planner's call **(unconfirmed)**: it only shows when something already
  broke.
