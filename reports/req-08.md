# req-08 — local usage analytics

Branch: `req-08-usage-analytics`. Gate: functional (DEC-009) — planning browser-verifies.

## Technical

### What changed

- **New module `src/analytics.js`** — a separate `localStorage` key `workout-mvp-analytics`,
  never touched by the workout store or its backup.
  - Shape `{ screens: {routeName: n}, transitions: {"from>>next": n}, buttons: {name: n} }`
    (bounded counts, not an event log).
  - Pure count logic exported for tests: `applyScreen(data, name, prevName)`,
    `applyButton(data, name)`, `emptyAnalytics()`.
  - Stateful glue: `recordScreen(name)`, `recordButton(name)`, `exportAnalytics()`.
  - **Fail-silent, guarded like `route.js`'s `visits`:** load parses with `try/catch`
    (falls back to empty on corrupt/oversized blob); `persist()` swallows a throwing
    `setItem` (quota / iOS private mode); each `record*` also wraps its body in `try/catch`
    so it can never throw into the UI, block navigation, or reach the workout save path.
    This is the deliberate opposite of req-01's surfaced save-failure banner (DEC-011).
- **`src/route.js`** — screen + transition recording hooked into `remember(hash)`, the single
  seam both navigation paths funnel through (`useHashRoute`'s `hashchange` handler, and `go()`
  via the resulting `hashchange`). Keyed by `parseRoute(path).name` (bounded ~44 names), never
  the id-bearing path. Only a real move to a **new** path records — mirrors `applyVisit`'s
  consecutive-dedupe, so re-navigating to the same screen isn't recounted and the initial
  `#/` redirect doesn't double-count `today`. The previous route name for the transition is
  tracked inside the analytics module (`prevScreen`).
- **Button instrumentation** — `recordButton('<stable-key>')` at the handler seam (so a key
  fires regardless of which screen renders the button):
  - In-workout (`Workout.jsx`): `complete-set`, `skip-set`, `previous-set`, `rest-pause`,
    `rest-resume`, `rest-plus-30`, `rest-next`, `finish-workout`, `abandon-workout`.
  - Data (`Settings.jsx`): `export-database`, `export-analytics`, `import`.
  - Data (`Today.jsx` empty-state importer): `import` (same key as Settings — one action).
- **`Settings.jsx`** — new **"Export analytics"** button, reusing the existing `downloadJson`
  helper → `workout-analytics-<date>.json` (the raw `exportAnalytics()` object). Separate
  action and separate file from the workout Export.

### Choices left open by the spec

- **Transition separator `>>`** (`"from>>next"`) — the planning message and the req doc's
  `<from>>><to>` template both use it; the single-`>` examples were shorthand. `>>` is
  unambiguous (route names never contain `>`).
- **Button keys are stable kebab strings, not label text** (per spec). `rest-next` is keyed by
  behaviour, not the "Next" label (was "Skip" pre-req-11), so the key survives copy changes.
- **`complete-set` records after the effort guard** — a Complete press that alerts "Pick effort"
  and returns is not counted, so the count reflects real set completions. `abandon-workout`
  records after the confirm's OK (a real abandon), not on the raw press.
- **Consecutive same-screen navigations don't count as a new view** — matches the `visits`
  dedupe. A genuine over-count that remains: none observed; the initial-load double was removed
  by the `changed` gate.

### Verified

- `node --test src/analytics.test.js` — **7 pass, 0 fail.** Covers: `applyScreen` increments
  screen + `prev>>next` transition (and repeats accumulate); self-transition not recorded;
  `applyButton` increments; **id-bearing paths collapse** (`/workout/routine-1/item/item-aaa/log`
  and `/workout/routine-9/item/item-zzz/log` both → `workout-item-log`, identical key sets);
  **fail-silent** (`setItem` stubbed to throw → `recordScreen`/`recordButton` do not throw);
  `exportAnalytics()` returns the live, reference-stable object; **isolation** (`ANALYTICS_KEY`
  ≠ `workout-mvp-v8`; `buildBackup(state)` output contains no `screens`/`transitions`/`buttons`).
- `./check` — **green:**
  ```
  # tests 91
  # pass 91
  # fail 0
  check: green — lint, 12 test file(s), and the build all passed.
  ```

### Acceptance criteria

- Counts accumulate — unit-tested (pure logic); browser-confirm pending.
- Isolation — asserted in test (separate key + backup has no analytics) and in the diff
  (analytics never imports the store/`saveState`; store never imports analytics).
- Fail-silent — unit-tested (throwing `setItem` swallowed, no throw).
- Export works — Settings "Export analytics" → `workout-analytics-<date>.json`; browser-confirm.
- Workout unaffected — no change to the store, save path, or backup; browser-confirm (required).
- Keys are route names not paths — unit-tested (id-paths collapse; store stays bounded).

## Workflow

- **No scope changes.** Built exactly the DEC-011 / req-08 shape: separate key, three count
  buckets, route-seam screens/transitions, instrumented action buttons, Settings export.
- **One naming decision to record if wanted:** the transition separator is `>>` and the button
  key set is the 12 keys listed above — surfaced here so they can become a `DEC-`/reference if
  the exported data's shape matters downstream.
- **Browser gate (required by the req):** confirm a normal workout — start, log sets, rest,
  finish — behaves exactly as before with analytics active, and that Export analytics downloads
  a JSON matching the counts. Automated checks cover the logic and the fail-silent guarantee but
  not the end-to-end browser behaviour.
