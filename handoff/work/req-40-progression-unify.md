# req-40 — one shared progression computation (Finish == recalc) (audit F-CODE-1)

**Status: READY.** From audit 2026-09-12 (F-CODE-1). **Gate: persisted-data /
behaviour → Emilio's hands before merge** (DEC-009) — it changes what
recommendation is written onto the routine at Finish.

## Why

The per-item progression (filter an item's working sets → `recommendNextPrescription`
→ next weights/targets) is computed **twice, with divergent matching**, so the
**same workout yields two different recommendations depending on the code path** —
failing DESIGN §2's test ("given the same history, does the recommendation always
produce the same explainable step?").

- **`finish.jsx:30-61`** (inline in the component) computes `progression` and passes
  it to `store.finishWorkout({ progression })`, which writes it onto the routine via
  `applyProgressionToRoutines` and stores it on the finished workout. **This is what
  Finish saves.** Set match: `set.routineItemId === itemKey(item)` **only**;
  `targetsTo: recommendation.targets` **unconditionally**; `String(set.reps)` (no
  `|| ''`).
- **`model.js:296-324` `progressionFromWorkout`** (used by
  `store.recalculateFuturePlans`, run when history is corrected) — set match:
  `(set.routineItemId || set.sessionItemId)` against `itemIdValue`(=
  `item.routineItemId||sessionItemId||id`) **or** `item.id`; `targetsTo`/`to`
  fall back to `item.targets`/`item.suggestedWeights` **when no sets matched**;
  `String(set.reps || '')`.

`itemKey(item)` (`workout-log.js:3`) already equals model's `itemIdValue`, so the
**item key** resolution agrees. The divergences are: (1) **set-side** — finish uses
`set.routineItemId` only, model uses `set.routineItemId || set.sessionItemId` plus an
`item.id` clause (finish misses legacy/fallback-keyed sets); (2) **empty-sets
fallback** — with no matched working sets, finish writes `recommendation.targets`
while model keeps `item.targets`. Same workout → possibly different saved next-plan.

## The fix — extract one pure helper, both callers use it

Per **L-007** (`store.jsx`/`.jsx` can't be unit-tested), the shared logic goes in a
**pure `.js` module** (`model.js`, beside `progressionFromWorkout`), not inline in
the view.

- Add a pure function to `model.js`, e.g.
  `progressionForItem(exercises, workout, item)` → `{ routineItemId, sets,
  recommendation, to, targetsTo }`, using the **canonical (model.js) semantics**:
  the fuller set match **and** the empty-sets fallback to `item.targets`/
  `item.suggestedWeights`.
- Rewrite `progressionFromWorkout` to map its snapshot items through the helper
  (returning its existing `{ routineItemId, to, targetsTo }` shape) — behaviour
  unchanged for the recalc path.
- Rewrite `finish.jsx`'s `progression` map to call the same helper for the core,
  then add its **display-only** fields (`from`, `exerciseId`, `name`, `action`,
  `reason`, the `skippedForItem` "Skipped."/"None." text) around it. The `to`/
  `targetsTo`/`routineItemId` it passes to `finishWorkout` now come from the helper.

Result: Finish and recalc share one matcher and one fallback → identical
progression on the same workout.

## Canonical choice (reconcile to model.js semantics)

Where the two differ, the **model.js** behaviour wins (it's the superset and the
more-correct fallback): match `routineItemId || sessionItemId` (+ `item.id`); when
no working sets matched, keep `item.targets`/`item.suggestedWeights` rather than
emitting a recommendation from zero sets. This is the reconciliation the audit
mandates, not a new user-facing choice — record it as a one-line DEC at merge.

## Scope

- New pure helper in `model.js`; `progressionFromWorkout` refactored onto it;
  `finish.jsx` refactored onto it (keeping its display fields).
- Tests in `src/model.test.js` (pure — L-007 satisfied).

## Out of scope

- Any change to `recommendNextPrescription` itself (`progress.js`) or to
  `applyProgressionToRoutines`.
- The recalc UX / the "history recalc from a non-latest workout" behaviour question
  (separate backlog item) — this req only makes the two computations *agree*.

## Ordered steps

1. Add `progressionForItem` (pure) to `model.js` with the canonical semantics above.
2. Refactor `progressionFromWorkout` onto it; keep its return shape identical.
3. Refactor `finish.jsx`'s progression map onto it; keep its display fields and the
   `finishWorkout({ progression })` call unchanged in shape.
4. Tests (`node --test`, `model.test.js`):
   - **the consistency test (the point):** a workout whose sets would match
     differently under the old two matchers (e.g. a set keyed by `sessionItemId`
     only, and/or an item with no working sets) → assert the helper (and
     `progressionFromWorkout`) produce the recommendation the finish path must now
     also produce. Since `finish.jsx` can't be imported (L-007), assert the shared
     helper's output equals what both callers rely on, and confirm by code that
     `finish.jsx` calls it.
   - the empty-sets fallback keeps `item.targets` (not a from-zero recommendation).
   - an existing-behaviour regression: a normal workout still yields the same
     progression it did before (guard the recalc path didn't shift).

## Acceptance criteria (written before implementation)

- `finish.jsx` and `progressionFromWorkout` both derive their per-item core from the
  **same** `model.js` helper — confirm in the report (both import/call it; no second
  inline set-filter remains). `git grep "setType !== 'wu'" src/views/workout/finish.jsx`
  returns nothing (the inline filter is gone).
- The consistency test passes: same workout → same `{to, targetsTo}` on both paths.
- `./check` green — paste the line. Existing progression/recalc tests stay green.

## Decisions

- **canonical semantics (record as DEC at merge):** unify to model.js's matching +
  empty-sets fallback; finish.jsx's narrower matching was the bug.
- **placement (fixed, L-007):** shared helper in `model.js` (pure), not in the view.

## Notes

Persisted-data/behaviour gate: at Finish the active workout's sets carry
`routineItemId`, so in practice the saved recommendation rarely changes — but it
*can* for fallback-keyed or all-skipped items, so **Emilio uses it before merge**:
do a normal workout, Finish, confirm the next-time weights/reps written to the
routine read right; then correct that workout in History and confirm the recalc
preview matches what Finish wrote. Follow L-001 for any browser data planting.
