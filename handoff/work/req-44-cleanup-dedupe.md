# req-44 — cleanup: dead export + dedupe drifted predicates (audit F-DEAD-1, F-STRUCT-1/2/3/5)

**Status: BUILT AND MERGED, 2026-09-12 — branch `req-44` (`875e1b9`…`875e1b9`, 1 commit).** From audit 2026-09-12 (F-DEAD-1, F-STRUCT-1/2/3/5). Pure
refactor, **no behaviour change**. **Gate: functional, but L-005 applies** — this
relocates symbols across modules, and oxlint does not flag a missing import, so the
receipts are an import audit + a browser walk of the affected screens (planning
walks them, or Emilio), not just `./check`.

## Why

Small, low-severity cleanups the audit found. Grouped into one reviewable refactor.
Sites re-verified against current `main` (post req-40/43):

- **F-DEAD-1 dead export:** `nextScheduled` (`schedule.js:147`) — no live caller
  (grep across `src` non-test → only the definition). Remove it.
- **F-STRUCT-2 `isSkippedSet` drift (the one with a latent bug):** the predicate
  `String(set?.reps || '').toLowerCase() === 'skipped'` is defined **twice**
  (`storage.js:344`, `workout-log.js:159`) and inlined at `model.js:88,152,321`,
  `item.jsx:127,312`, and **`finish.jsx:36` — which drops the `|| ''` guard**
  (`String(set.reps)`), a latent `null`/`undefined` inconsistency. Unify to one
  exported helper and fix the finish.jsx site by using it.
- **F-STRUCT-1 `isDurationTarget` duplicated:** identical private fn in
  `progress.js:41` and `item.jsx:30`. Export one, drop the copy.
- **F-STRUCT-3 uses-weight predicate, 4 spellings:** `usesWeight` (`item.jsx:27`,
  on `ex.type`), `usesLoad` (`item.jsx:445`, on `item.exerciseType`), `weighted`
  (`model.js:353`, on `exercise.type`), and the inverse `bodyweight`
  (`progress.js:71`). Unify to one pure `isWeightedType(type)` that takes the raw
  type string; each caller passes its own field.
- **F-STRUCT-5 double weight-split:** `Routine.jsx` `ExerciseFields` splits
  `weights` twice — `:284-287` (for the `count` max) and `:299-302` (for
  `suggestedWeights`). Compute once, reuse.

## The fix (placement — pure modules, L-007)

- `isSkippedSet(set)` → export from **`workout-log.js`** (the domain module; it
  already defines it). `storage.js`, `model.js`, `item.jsx`, `finish.jsx` import and
  use it. This removes the `finish.jsx` unguarded-`String(set.reps)` variant.
- `isDurationTarget(value)` → export from **`progress.js`**; `item.jsx` imports it.
- `isWeightedType(type)` → add to **`ids.js`** (pure, beside `EXERCISE_TYPES`);
  replace the four spellings (`progress.js`'s `bodyweight` becomes
  `!isWeightedType(type)`). Keep each call site reading the **same field** it reads
  now (`ex.type` / `item.exerciseType` / `exercise.type`).
- `Routine.jsx`: hoist the `weights.split(/[/,]/)...filter(Number.isFinite)` into one
  `weightParts` const, reuse for both `count` and `suggestedWeights`.

## Scope / Out of scope

- **In:** the five dedups above; no logic change — every call must compute the same
  value it does today.
- **Out:** the module splits of `model.js`/`item.jsx` (F-STRUCT-4) — deferred
  (low-value, higher risk). `@types/*` devDeps (F-DEAD-2) — keep (DX aid). The
  `plan doctor` content-check — its own req (req-45).

## Ordered steps

1. Remove `nextScheduled` from `schedule.js`.
2. Export `isSkippedSet` (`workout-log.js`); replace the `storage.js` dup + the
   inline uses in `model.js`/`item.jsx`/`finish.jsx` — **finish.jsx now uses the
   guarded helper** (behaviour-preserving except it no longer mishandles a null
   `reps`, which the old finish site technically could).
3. Export `isDurationTarget` (`progress.js`); `item.jsx` imports it, drop its copy.
4. Add `isWeightedType(type)` (`ids.js`); replace the four uses-weight spellings.
5. `Routine.jsx`: single `weightParts`.
6. **Import audit (L-005):** every symbol used in a touched file resolves to an
   import or local def; every relocated symbol is imported where used.
7. Tests (`node --test`): pure unit tests for `isSkippedSet`, `isDurationTarget`,
   `isWeightedType` (incl. the `null`/`undefined` reps case for isSkippedSet). All
   existing tests stay green.

## Acceptance criteria (written before implementation)

- `git grep nextScheduled src` returns nothing.
- One definition each of `isSkippedSet` / `isDurationTarget` / `isWeightedType`
  (exported); the old inline copies are gone — show the greps in the report.
- New pure tests pass, including `isSkippedSet` on `{reps: null}` / `{}` (the
  finish.jsx guard fix). Command + output.
- `./check` green — paste the line.
- **L-005 receipts:** the import audit (stated per touched file) **and** a browser
  walk of the affected screens — the live **Workout set-log** and **Finish**
  screens (item.jsx/finish.jsx), the **Routine** editor, and **Exercises** — render
  and behave unchanged. Planning walks these (or Emilio); a green `./check` is NOT
  sufficient for a cross-module relocation (L-005).

## Decisions

- **behaviour:** none — pure dedupe/removal. If any call would change value, stop
  and flag it.
- **placement (fixed):** `isSkippedSet`→workout-log.js, `isDurationTarget`→progress.js,
  `isWeightedType`→ids.js.

## Notes

L-005 is the reason this isn't a trust-the-gate merge: a forgotten import passes
lint+build+tests and only blank-screens at runtime. The browser walk of the gym-flow
screens is the gate. Keep the diff a pure move — an import-block-stripped body diff
should show unchanged executable lines at each call site.
