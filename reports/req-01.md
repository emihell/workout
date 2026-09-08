# req-01 — guard saveState against a failed write

Branch: `req-01-guard-savestate`. Implements DEC-001 (persistent banner on save failure).

## Technical

### What changed

**`src/storage.js`**
- `saveState` now wraps `localStorage.setItem` in `try/catch`. On success it clears the
  failure signal and returns `true`; on a throw it sets the signal and returns `false` —
  the throw never escapes. The successful path is byte-for-byte unchanged: same key
  (`workout-mvp-v8`), same `JSON.stringify(state)`, written first, before any signal
  bookkeeping.
- Added a module-level "last save failed" signal exposed as a subscribable external store:
  `getSaveFailed()` (snapshot), `subscribeSaveFailed(listener)` (returns an unsubscribe),
  and an internal `setSaveFailed(value)` that only notifies on an actual change.

**`src/App.jsx`**
- New `SaveFailedBanner` component reads the signal via `useSyncExternalStore` and renders a
  persistent `role="alert"` banner when the last save failed, nothing when it didn't. It has
  no dismiss control — it disappears on its own when a save succeeds and the signal clears.
- Mounted once in the app shell above `<Nav>`, so it is visible on every screen.

**`src/storage.test.js`**
- New `describe('saveState guards a failed write')` with the three required cases (a/b/c).

### Implementation choices the spec left to me

- **Signal shape (spec step 1 left this open):** a module-level flag in `storage.js` plus a
  subscribe/snapshot pair, consumed with React's `useSyncExternalStore`. Chosen over
  threading a boolean through React state because `saveState` runs *inside* the store's
  `setState` updater (`store.jsx:16`); calling a second React setter from within that updater
  is the "update a component while rendering another" anti-pattern. An external store keeps
  `saveState` a plain, node-testable function and lets the banner subscribe independently of
  the store. The store's updater is left completely untouched.
- **Banner placement/markup:** plain `<div role="alert">` in the shell, above the nav, app is
  zero-CSS today so no styling added (matches the current app). Wording per DEC-001:
  *"Couldn't save your last change. Your data may not persist — export a backup from Settings."*

### Why the "right mechanism" criterion holds

A bare `catch {}` that swallowed silently would fail test (a): it asserts
`getSaveFailed() === true`, not merely "did not throw". Test (b) asserts a normal save leaves
it `false`; test (c) asserts throw-then-succeed ends `false` (the banner clears on recovery).

### Verification (receipts)

`./check` — green:

```
# tests 57
# suites 18
# pass 57
# fail 0
check: green — lint, 9 test file(s), and the build all passed.
```

The three new tests, from the run:

```
# Subtest: saveState guards a failed write
    ok 1 - does not throw and sets the failure signal when setItem throws
    ok 2 - a normal save leaves the failure signal clear
    ok 3 - a throwing save followed by a succeeding one ends clear
ok 15 - saveState guards a failed write
```

The pre-existing oxlint warning (`src/views/Routine.jsx:13` fast-refresh export) is unrelated
and untouched by this branch.

### What I could not verify myself

The banner actually appearing/clearing in a real browser (DEC-001's human "use it" gate):
fill quota or write from a Safari private window, confirm the banner shows on a failed save
and disappears after the next successful one. Tests cover the signal; they don't render the DOM.

## Workflow

- No scope added or dropped; built exactly the three ordered steps. No mid-build decisions with
  Emilio were needed.
- One thing worth recording as a note (not a new DEC — it's an implementation fact, Emilio's
  call whether it's worth an `L-`): the reason the signal is an external store rather than a
  store field is the updater-purity constraint above. If a future req wants save-failure state
  visible *through the store API* (e.g. to show it inside a specific view), that would reintroduce
  the anti-pattern unless done via the same external-store hook.
