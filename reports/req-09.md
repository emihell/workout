# req-09 — keep the screen awake during an active workout

Branch: `req-09-wakelock-during-workout`. **Ready to look at — not merged.** Gate:
device-verified → Emilio's real-device check before merge (the wiring is verified here;
the actual screen-stays-awake effect is only provable on a phone).

## Technical

### What changed

- **`src/wake-lock.js`** (new) — a `WakeLock` shell component. Renders `null`; no UI.
  Reads `useStore().activeWorkout` and, in an effect keyed on whether a workout is active:
  - **Acquires** `navigator.wakeLock.request('screen')` and stores the sentinel while a
    workout is active.
  - **Releases** the sentinel when `activeWorkout` goes null (Finish/Abandon) or on unmount
    (the effect cleanup).
  - **Re-acquires** on `visibilitychange` → `visible` while still active — the browser
    auto-releases the lock when the tab backgrounds or the screen locks, so without this it
    silently stops working after the first backgrounding. Only re-requests if our sentinel is
    gone or `released`, so a benign visibility event while the lock is live doesn't spawn a
    duplicate.
  - **Feature-detects** `navigator.wakeLock` — absent → the whole effect is a no-op (no
    listener registered, no request).
  - **Fail-silent** throughout: every `request`/`release` is wrapped so a rejection is
    swallowed. A wake-lock failure never throws or touches the workout/logging/save path
    (same principle as req-08). An in-flight request that resolves after cleanup releases
    immediately instead of leaking (`cancelled` flag).
- **`src/App.jsx`** — mounts `<WakeLock />` inside `StoreProvider`, directly above
  `<SaveFailedBanner />`, per the spec. It's app-shell-level but scoped by `activeWorkout`,
  so it is only armed during a workout — not while browsing routines/schedule/history/settings.
- **`src/wake-lock.test.js`** (new) — 8 tests, react-test-renderer + a mocked
  `navigator.wakeLock` and a stub `document` (DEC-007).

Named `.js`, not `.jsx`: the component contains no JSX (returns `null`), so `node --test` can
import it directly — the same reason `error-boundary.js` stays plain `.js`. Local imports carry
the `.js` extension for the same node-ESM reason as the rest of `src/`.

### What I verified — acceptance criteria as receipts

`node --test src/wake-lock.test.js` → **8/8 pass**, mapping to the criteria:

- **Requested on active** — `requests a screen lock when a workout becomes active`
  (null → active transition requests exactly one `'screen'` lock).
- **Released on end** — `releases the lock when the workout ends (activeWorkout → null)`
  + `releases the lock on unmount`.
- **Re-acquire on visibility** — `re-acquires on visibilitychange→visible after the browser
  auto-released it` (sentinel marked `released`, then hidden→visible → a second request).
  Plus the guard: `does not re-request on visibilitychange when the lock is still live`.
- **Unsupported / throwing is silent** — `is a silent no-op when navigator.wakeLock is
  undefined` (no throw, no visibility listener registered) + `swallows a rejecting request
  without throwing`.
- **Scoped** — `does not request a lock when there is no active workout`.

Full gate:

```
check: green — lint, 11 test file(s), and the build all passed.
# tests 81
# pass 81
# fail 0
```

### What I could not verify (needs a real device — Emilio's gate)

The actual effect: on a phone, start a workout and leave it idle through the normal auto-sleep
timeout → the screen should stay on; Finish/Abandon → normal sleeping resumes; background the
tab and return mid-workout → still holds. `react-test-renderer` has no DOM and no real
`navigator.wakeLock`, so this session verifies the API is called correctly, not that the pixels
stay lit.

## Workflow

- **No scope changes.** Built exactly what the spec and the planning message described:
  shell-level component in `App.jsx` alongside `SaveFailedBanner`, keyed on `activeWorkout`,
  fail-silent, visibility re-acquire, feature-detected. No UI, no toggle.
- **One implementation choice the spec left open:** the visibility re-acquire only fires a new
  request when the held sentinel is missing or `released` (checking the real
  `WakeLockSentinel.released` flag), rather than blindly re-requesting on every visible event.
  This avoids abandoning a still-live lock and matches how the browser actually reports
  auto-release. Covered by a dedicated "still live → no duplicate" test.
- **`.js` not `.jsx`:** followed the existing `error-boundary.js` convention (no-JSX component
  so `node --test` imports it) rather than introducing a `.jsx` the test runner can't load.
  Nothing to decide here; noting it so the file naming isn't a surprise.
- Nothing needed Emilio mid-build. No new `DEC-`/`L-` candidates beyond what the spec already
  anticipates (the device-only-verifiable gate is already named in the req).
