# req-41 — warn when another tab changes the data (audit F-RISK-3, DEC-029)

Branch `req-41`. Gate: functional. Warn-only, writes no data.

## Technical

**What changed**

- `src/storage.js`
  - `isExternalStateChange(event)` — pure predicate, exported:
    `event.key === STORAGE_KEY || event.key === null` (a `null` key = a
    `localStorage.clear()` in another tab). This is the one testable decision.
  - Signal trio mirroring `saveFailed`/`loadUnreadable`:
    `getExternalChanged()` / `subscribeExternalChange(listener)`, backed by a
    single `window` `storage` listener. The listener is registered **lazily on
    first subscribe** and removed on **last unsubscribe**, guarded by
    `typeof window !== 'undefined'` so `storage.js` still imports under
    `node --test`. On a matching event it latches `externalChanged = true` and
    notifies subscribers.
- `src/App.jsx`
  - `ExternalChangeBanner` via `useSyncExternalStore`, distinct from
    `SaveFailedBanner`/`LoadUnreadableBanner`. Wording:
    "Another tab changed your data — reload to see the latest." with a
    **Reload** button (`window.location.reload()`). Rendered alongside the other
    two banners in `App`.
- `src/storage.test.js`
  - Four cases for `isExternalStateChange`: true for `'workout-mvp-v8'` and
    `null`; false for `'workout-mvp-analytics'` and `'something-else'`.

**Choices left open by the spec (mine)**

- **Latch is one-way** (no clear path). Once another tab changes the data, this
  tab is stale until it reloads — there is nothing to un-warn while it still
  holds the old snapshot. A reload mounts a fresh module and re-reads the latest,
  which clears it. Matches "a reload clears it" in the spec.
- **Reload affordance**: an inline button rather than a link (spec said "a reload
  affordance is welcome").
- **Lazy listener lifecycle**: registered on first subscribe, torn down on last
  unsubscribe (CC's call per spec). In practice `useSyncExternalStore` keeps one
  subscription alive for the app's lifetime, so the listener is added once at
  mount.

**Verification**

- New predicate tests — all four pass:

  ```
  ok 1 - is true when another tab wrote our key
  ok 2 - is true when another tab cleared storage (key === null)
  ok 3 - is false for a different app key
  ok 4 - is false for an unrelated key
  ```

- Existing storage tests stay green (window guard holds — `storage.js` imports
  under `node --test` with no `window`).

- `./check` green:

  ```
  # tests 165
  # pass 165
  # fail 0
  check: green — lint, 15 test file(s), and the build all passed.
  ```

## Workflow

- No scope deviation. Built exactly the three pieces in the spec: pure predicate
  + signal in `storage.js`, distinct banner in `App.jsx`, predicate test.
- Nothing rode along. No changes to `saveState`/`loadState` read/write behaviour
  (out of scope, respected).
- Nothing new for `DEC-`/`L-`. Followed L-007 (pure predicate unit-tested; window
  wiring + JSX are the untestable thin layer, left to the browser check).

## What I could not verify (the real gate)

The two-tab end-to-end can't run under `node --test`. Needs a browser:

1. Open the app in two tabs (same origin).
2. In tab A, finish/log a workout (any change that calls `saveState`).
3. Tab B shows the banner "Another tab changed your data — reload to see the
   latest." with a Reload button; clicking it reloads and the banner is gone.
4. Tab A (the writer) does **not** show the banner.

L-001: if testing on a real profile, snapshot `workout-mvp-v8` first, or use a
throwaway/dev origin.
