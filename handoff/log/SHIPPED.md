# Shipped

Append-only narrative of what shipped under this workflow, newest at the bottom. This is
the detail that `NOW.md` points to — `NOW.md` carries only the last few lines, the full
story lives here.

Each entry: the req, one paragraph on what it changed and why, the merge commit, and the
gate result (`./check` green, N tests).

---

## req-01 — guard saveState against a failed write  (merged 2026-09-08)

`saveState` (`storage.js`) now wraps `localStorage.setItem` in try/catch: on a throw (quota
exceeded, Safari/iOS private mode) it sets a subscribable "save failed" signal and never lets
the throw escape the store's `setState` updater; on success it clears the signal. A persistent,
non-dismissable banner in the app shell shows whenever the last save failed and clears on the
next success (DEC-001). The successful write is byte-for-byte unchanged. The signal is an
external store consumed via `useSyncExternalStore`, chosen so `saveState` stays a plain
node-testable function and the updater is untouched. Merge `ac72dbf` (branch
`req-01-guard-savestate`, `85d3887`). `./check` green, 57 tests (3 new). Browser gate: banner
verified showing on a forced `setItem` throw and clearing on reload.

## req-05 — error boundary so a render crash doesn't blank the app  (merged 2026-09-09)

New `ErrorBoundary` class component wraps `<Screen/>` inside `<main>` (`App.jsx`), so a
render-time throw on any screen shows a self-contained fallback (a "data is saved" reassurance +
Reload button + Back-to-Today link) instead of unmounting to a blank page, keeping `Nav` and the
save-failed banner visible. The boundary clears its error on `hashchange`, so navigating to a
working screen recovers without a reload (DEC-007). `react-test-renderer` added as a devDependency
to prove the catch on a real render throw. Merge `013beb6` (branch `req-05-error-boundary`,
`1e23f0e`). `./check` green, 59 tests (2 new). Browser gate: fallback rendered in place with Nav
intact, and clicking Routines recovered the app (verified 2026-09-09).

## req-03 — persistent workout-level rest timer  (merged 2026-09-09)

The rest counter used to vanish the moment you left the single set-logging screen: rest state
was workout-level and persisted (`activeWorkout.restEndsAt` / `restPausedRemaining`), but the
countdown UI and its 250ms tick lived only inside `WorkoutItemLive`. Fixed (DEC-003) by lifting
it into one self-hiding `RestBar` rendered on every in-workout screen (overview, item log,
review, finish, plus exercise-edit and set-edit — the two extra mid-rest-reachable screens),
driven by the shared `useRestCountdown` hook; `RestBox` removed so there is exactly one rest UI.
The pure recompute was extracted to `restRemaining(active, now)` in `workout-log.js` and
unit-tested (recompute-not-frozen, paused, expiry, no-rest). No auto-start between exercises
(declined, DEC-003). Merge `f54aa86` (branch `req-03-persistent-rest-timer`, `7ed39e3`).
`./check` green, 63 tests (4 new). Browser gate (run by the planning session at Emilio's
direction, 2026-09-09): counter persisted 88s→75s across item→overview navigation, Pause on the
overview showed "Paused" on the Finish screen with the controls, Skip cleared the bar, and the
bar self-hid when no rest was active.

## req-02 — carry entered kg+reps to the next set for a no-history exercise  (merged 2026-09-09)

For an exercise with no finished-workout history, logging a working set now seeds the next
working set's kg + reps from the most recent non-skipped working set logged this session
(DEC-002) — an editable prefill of the user's own input, not invented data. With-history
exercises keep their existing per-set history prefill: the new `setLogSeed` fallback is
byte-identical to the old history path, and `carryFor` returns null whenever history is present,
so the core "history is the source of truth" rule is untouched. Warm-up and effort unaffected.
Pure helpers `carriedWorkingSet` + `setLogSeed` in `workout-log.js`, unit-tested (carry,
follows-most-recent, skipped-source-ignored, all-skipped→null, first-set blank/target,
with-history scope guard, restore-wins). Merge `97412d8` (branch `req-02-carry-value-no-history`,
`ea0c12c`). `./check` green, 73 tests (10 new). Browser gate (planning session, functional): set 1
showed blank kg + target reps; entered 99 kg × 7; set 2 prefilled 99 × 7, editable — carry
confirmed end-to-end.
