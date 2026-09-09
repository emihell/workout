# req-08 — local usage analytics: screen + transition + button counts, exportable

**Status: BUILT AND MERGED, 2026-09-09 — branch `req-08` (`f824ce9`…`f824ce9`, 1 commit).** — decisions settled (DEC-011). Independent of all other reqs.

**Gate: functional** (DEC-009) — records to a *separate*, isolated `localStorage` key that can't
touch workout history, with fail-silent writes; the planning session can browser-verify counting
and export, plus confirm a workout is unaffected. Closed by the planning session (no human gate) —
but the browser check MUST include "a normal workout still logs and saves correctly with analytics
active."

## Why

Emilio wants to learn the app's real usage — the most common **flows** (what screen follows what)
and the most-pressed **buttons/actions** — to guide where the "flawless gym flow" effort goes.
There is no backend, so this is a small on-device counter he can export and analyze off-device.

## The behaviour (decided — DEC-011)

- A **separate `localStorage` key `workout-mvp-analytics`**, isolated from the workout state
  (`workout-mvp-v8`). Never included in the workout backup/export; no schema migration.
- **Bounded aggregate counts**, shape:
  ```
  { screens:     { <routeName>: n },          // e.g. { "workout-item-log": 42 }
    transitions: { "<from>>><to>": n },        // e.g. { "today>workout": 20 }  (from-name > to-name)
    buttons:     { <actionName>: n } }         // e.g. { "complete-set": 120 }
  ```
  Screens/transitions are keyed by the **parsed route name** (`parseRoute(...).name`, ~44 bounded
  names) — **never** the id-bearing path, or every exercise/workout becomes a distinct screen.
- **NOT an ordered event log** (rejected — unbounded growth + write-on-every-press quota risk).
- **Writes are best-effort and fail silently** — a throwing analytics write (quota, iOS private
  mode) is swallowed and never surfaces, never blocks navigation, never touches the workout save
  path or its banner. Losing analytics is acceptable; the workout is sacred.
- **Export button in Settings** (reuse the existing `downloadJson` helper) →
  `workout-analytics-<date>.json` — the raw analytics object. Separate action from the workout
  Export.

## Scope

- **Screens + transitions:** record on every navigation, at the existing route seam
  (`src/route.js` — `useHashRoute` / `remember` already fire on every `hashchange` and already
  parse the route). Increment `screens[name]`, and `transitions["<prev>>><name>"]` using the
  previous route name (CC tracks the previous name; the existing `visits` stack is a reference,
  not a requirement to reuse).
- **Buttons:** count a defined set of **primary, mostly non-navigating action buttons** — at
  minimum the in-workout actions: complete set, skip set, pause, resume, +30s, previous,
  finish/save workout, abandon; plus import and both exports. Navigating links need not be
  instrumented (they already show as transitions). Use a small stable helper (e.g.
  `trackButton('complete-set')`) with **stable string keys** (not raw visible label text, which
  changes with styling/copy). CC picks the exact seam (a helper called from each handler, or a
  wrapper) and names the keys — list them in the report.
- A small analytics module (load/save the key with try/catch like `route.js`'s visits pattern;
  `recordScreen(name)`, `recordButton(name)`, `exportAnalytics()`), CC's structure.

## Out of scope

- Any in-app analytics dashboard/view (export only, per DEC-011 — mobile-primary, pre-styling).
- Cross-user aggregation or any network send (browser-only; per-device — Phase 3 / backend).
- Timestamps or session/event logs (counts only).
- An opt-out toggle (local, private, single-user for now; revisit if it ships to real users).
- Touching `workout-mvp-v8`, the store, the backup format, or the save path.

## Ordered steps

1. New analytics module: read/write `workout-mvp-analytics` with try/catch (fail-silent),
   exposing `recordScreen(name)`, `recordButton(name)`, and a getter for export. Never throws.
2. Hook screen + transition recording into the route seam (`route.js`), keyed by route **name**,
   tracking the previous name for the transition. No behaviour change to navigation itself.
3. Add `trackButton('<stable-key>')` calls to the defined primary action buttons.
4. Add an **Export analytics** button in `Settings.jsx` using `downloadJson` →
   `workout-analytics-<date>.json`.
5. Tests (`node --test`): the pure count logic — recordScreen increments the screen and the
   `prev>>next` transition; recordButton increments the button; a **failing storage write is
   swallowed** (stub setItem to throw → record does not throw); export returns the current object.

## Acceptance criteria (written before implementation)

- **Counts accumulate (the point):** navigating today→workout→item-log and pressing Complete
  yields `screens` incremented for each, `transitions["today>>workout"]` etc. incremented, and
  `buttons["complete-set"]` incremented. Prove the pure logic with unit tests; confirm end-to-end
  in the browser.
- **Isolation:** `workout-mvp-v8` is never written by analytics; the workout backup/export does
  **not** contain analytics data. Assert in the diff + a test that the workout backup is unchanged.
- **Fail-silent (failure case, required):** with `localStorage.setItem` stubbed to throw,
  `recordScreen`/`recordButton` do **not** throw and navigation/logging continue normally — the
  workout is unaffected and its save-failure banner (req-01) is the only thing that ever surfaces
  a storage problem. Unit test + a note.
- **Export works:** the Settings Export analytics button downloads a JSON file equal to the stored
  analytics object. (Human/browser check.)
- **Workout unaffected (required browser check):** a normal workout — start, log sets, rest,
  finish — behaves exactly as before with analytics recording active. (Planning-session browser
  gate.)
- **Keys are route names, not paths:** two different workouts/exercises map to the same
  `screens`/`transitions` keys (by route name), so the store stays bounded. Assert via a test that
  id-bearing paths collapse to their route name.
- `./check` green; paste the line.

## Notes

Pairs conceptually with the mobile-primary priority (DEC-010): the flows this reveals are mobile
flows. The per-device limitation (DEC-011) means the data is Emilio's own until the backend exists;
useful now for guiding the Phase-1 gym-flow work, not for population-level analytics.
