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
2. Validate one level deeper at unwrap: workouts, exercises and routines must be objects; `sets`, `exercises` and
   `items` must be arrays. A failure is a clear "Not a valid backup" error.
3. A v9 value that parses to a non-plain-object is **unreadable** (the DEC-032 path: never overwritten, banner
   shown), not spread.
4. Last resort: an ErrorBoundary **above** `StoreProvider`, so no render throw leaves a blank page.

## Scope

`store.jsx`, `exchange.js`/`import-backup.js` (validation), `storage.js` (non-object guard), `App.jsx`/`main.jsx`
(outer boundary), tests.

## Acceptance criteria

- **Failure case (render test through the real StoreProvider):** import the analytics export → an error message
  shows; the tree still renders; stored state is unchanged. Import `{workouts:[null]}` → the same.
- **Success (render test):** a valid backup imports as before, and round-trips deep-equal.
- **Non-object v9 (unit):** v9 = `"x"` plus a v8 key → unreadable is latched and the v8 key is still present.
- **No regression:** `./check` green; all migration tests unchanged. Receipt quoted.

## Decisions

- An outer ErrorBoundary as a last resort. Planner's call **(unconfirmed)**: it only shows when something already
  broke.
