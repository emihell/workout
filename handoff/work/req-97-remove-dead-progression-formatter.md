# req-97 — delete the now-unused formatProgressionLine (req-96 follow-up)

**Status: READY. Gate: functional (dead-code removal, no behaviour change).**

From the req-96 review: with the "Next time" surfaces gone, `formatProgressionLine` has no callers.
Emilio (2026-09-17): fix now.

## Scope — one function only

[measured] After req-96, `formatProgressionLine` (`src/progress.js:124`) has **zero callers** in `src/`
(the only user was `history/detail.jsx`, removed in req-96) and **no test** references it
(`grep -rn formatProgressionLine src` → definition only).

- Delete `export function formatProgressionLine` from `src/progress.js` and any now-unused helpers it
  alone used (check `weightsMoved`/local scope — nothing else in the file should break).

## NOT dead — do NOT touch (verified in the req-96 review)

The rest of the progression machinery is **live**, not dead — leave it exactly as is:
- `buildFinishProgression` (`model.js:364`) and `progressionForItem` (`model.js:329`) still feed
  **`applyProgressionToRoutines`** (`store.jsx:351,377`), which updates routine templates at finish.
  (It's a no-op when no RPE is logged, but it is wired and must keep working.)
- The persisted `workout.progression` field (`store.jsx:373,380`) — still written; write-only now but a
  harmless record of the finish-time recommendation. **Do not** change the persisted shape (that would
  be an ask-gate #2 change for no gain).
- `recommendNextPrescription`, `moveToValidWeight`, `validWeights`, `formatSetLine`, etc. — all still used.

## Out of scope

- Any change to persisted data or to routine-progression behaviour.
- The load-recommendation feature's fate (retired-in-practice because RPE isn't logged) — a product
  question, not this cleanup.

## Acceptance criteria

- `formatProgressionLine` gone from `src/progress.js`; nothing imports it (`grep` clean).
- `applyProgressionToRoutines` and the finish flow unchanged — `model.test.js` progression tests still
  pass.
- `./check` green.

## Decisions

- Delete only `formatProgressionLine`; the rest of the progression code stays (Emilio, 2026-09-17 —
  correcting the earlier "dead code" over-call: only this one function was actually unused).
