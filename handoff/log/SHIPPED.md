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

## req-04 — deploy to Pages only when build inputs change  (merged 2026-09-09)

`.github/workflows/deploy.yml` triggered on every push to `main`, redeploying the live app even
for planning-doc-only publishes that change nothing built (the recurring waste the loop kept
hitting). Added a `paths` include-list to the push trigger — `src/**`, `public/**`, `index.html`,
`package.json`, `package-lock.json`, `vite.config.js`, and the workflow itself — so doc-only
pushes (`handoff/**`, `reports/**`) no longer deploy; build + publish steps unchanged. Verified the
list covers every real build input (`vite.config.js` filename confirmed, `public/` present).
Merge `ec104e5` (branch `req-04-deploy-only-on-build-changes`, `571bcef`). `./check` green, 73
tests. Real-push confirmation (infra can't be proven by `./check`) — **confirmed via GitHub Actions**:
the req-04 merge `32fddd2` (touched `deploy.yml`) triggered a deploy run; the very next push, the
doc-only maintenance publish `c10867e` (handoff/ + reports/ only), triggered **no run** — the
`paths` filter skipped it. Earlier doc pushes deployed only because they predate the filter
landing on `main`.

## req-09 — keep the screen awake during a workout  (merged 2026-09-09; device-confirmed)

Screen Wake Lock while a workout is active. A shell-level `WakeLock` component (`src/wake-lock.js`,
mounted in `App.jsx` inside `StoreProvider`) reads `useStore().activeWorkout`; while active it holds
`navigator.wakeLock.request('screen')`, releases on workout end/unmount, and re-acquires on
`visibilitychange→visible` only when the sentinel was auto-released (browsers drop it on
backgrounding). Feature-detected + fail-silent — an in-flight request resolving after cleanup is
released via a `cancelled` flag, and any reject is swallowed; a wake-lock failure never touches the
workout. Scoped to an active workout, never app-wide. 8 react-test-renderer tests. Merge `6807154`
(branch `req-09-wakelock-during-workout`, `119e251`). `./check` green, 81 tests. **Merged BEFORE the
device check** by Emilio's explicit merge-then-verify-live approval — the device-verified gate needs
a secure context (`navigator.wakeLock` runs only on HTTPS/localhost), which a pre-merge LAN branch
can't give a phone; the feature is fail-silent + scoped, so the risk was low (see L-003).
**Device-confirmed on the live HTTPS site (Emilio, 2026-09-09): "works well"** — screen stays on
during a workout as intended. Gate fully closed.

## req-11 — in-gym flow cleanup  (merged 2026-09-09)

Five workout-flow refinements: rest bar regrouped to `[Pause/Resume · +30s]` … `[Next]` (Skip
renamed, far right); equipment/cues hidden during rest only; the generic `<Back/>` replaced by a
semantic "‹ Exercises" link on the in-exercise screens (Previous kept) — no more double
back-button; the per-exercise review screen dropped from the completion flow (the last set
auto-marks the exercise done via pure `markItemDonePatch` and goes straight to the overview), kept
reachable by re-entering a completed exercise ("Add set" reopens it via `reopenItemPatch` — DEC-014);
and the redundant `<Back/>` removed from the Settings main (the only top-level main that had one —
DEC-015; the other mains were already clean). Mark-done/reopen patches unit-tested; browser-verified
end-to-end (scope 1–4) and diff-verified (scope 5). Merge `77a1161` (branch
`req-11-ingym-flow-cleanup`, `c14f284`…`9d444ff`, 2 commits). `./check` green, 84 tests. Emilio
approved merge on the planning session's verification.

## req-08 — local usage analytics  (merged 2026-09-09)

A separate `localStorage` key `workout-mvp-analytics` (`src/analytics.js`), isolated from
`workout-mvp-v8` — never in the workout backup, no migration. Bounded aggregate counts
`{ screens, transitions ("from>>to"), buttons }`, keyed by the parsed route name (never id-bearing
paths, so it stays bounded). Screens + transitions recorded at `route.js`'s `remember()` seam (once
per real nav, self-transition skipped); 12 primary action buttons instrumented via `recordButton`
(complete-set, skip-set, previous-set, rest-pause/resume/plus-30/next, finish/abandon-workout,
export-database, export-analytics, import). Writes are **fail-silent** (load/persist/record all
try/catch) — the opposite of req-01's surfaced save failure: losing analytics is acceptable, the
workout is sacred. "Export analytics" button in Settings → `workout-analytics-<date>.json`. Pure
`applyScreen`/`applyButton` unit-tested; 7 analytics tests (counts, self-transition skip,
path-collapse, fail-silent, export, isolation). Merge `72d7be9` (branch `req-08-usage-analytics`,
`f824ce9`). `./check` green, 91 tests. Browser-verified (planning session, functional): navigating
incremented screens + transitions (`>>` separator), logging a set recorded `complete-set:1` AND
saved to the workout normally, and `workout-mvp-v8` had no analytics field (isolation confirmed).
Impl notes: separator `>>`; `complete-set` counts after the effort guard, `abandon` after the confirm.

## req-06 — remove legacy localStorage keys after a confirmed v8 write  (merged 2026-09-09; phone-verify pending)

`loadState` (`src/storage.js`) migrated `v7/v6/v5` → `v8` but never removed the legacy keys,
leaving stale duplicate copies. New `removeLegacyKeysIfV8Persisted()` (called at the end of
`loadState`) deletes the legacy keys **only after reading `workout-mvp-v8` back and getting
non-null** — a silent-fail write (setItem stores nothing without throwing) leaves `getItem` null →
no delete, so the only surviving copy of the user's history is never destroyed. Never touches `v8`;
wrapped so a throwing read/remove degrades to "legacy stays" (never `emptyState`). The v8 write path
is byte-for-byte unchanged. Runs on both the migrate path and the already-v8 path (reclaims a
leftover legacy key from an interrupted cleanup). Merge `9c36887` (branch `req-06-legacy-key-cleanup`,
`f0c6253`). `./check` green, 96 tests, including the two required failure cases (throwing write +
silent no-op → legacy key survives). Verified: happy path in a real browser (seeded `v7` → migrated
to `v8`, legacy removed); the read-back gate + silent-fail survival by the genuine unit tests. Merged
on Emilio's merge-then-verify-on-phone approval (persisted-data; his phone store can't be inspected
pre-merge, and it never deletes `v8`). **Outstanding: Emilio confirms his workouts are intact next
time he opens the app on his phone.**
