# req-97 — delete the now-unused formatProgressionLine (req-96 follow-up)

Branch: `req-97` (off `main`). Dead-code removal, no behaviour change.

## Technical

- Deleted `export function formatProgressionLine` from `src/progress.js` (was
  lines 124–135, the last export in the file). Its only caller was the history-detail
  "Next time" surface removed in req-96; it had no test.
- **No helpers to clean up:** the function used only locals (`weightsMoved`, `repsMoved`,
  `bits`) — no module-level helper existed solely for it, so nothing else in
  `progress.js` became unused.
- **Left untouched (verified live, per spec):** `buildFinishProgression`,
  `progressionForItem`, `applyProgressionToRoutines` (routine-template update at finish,
  `store.jsx:351,377`), the persisted `workout.progression` field and its shape, and
  `recommendNextPrescription` / `moveToValidWeight` / `validWeights` / `formatSetLine`.

## Verified

- `grep -rn formatProgressionLine src` → **empty** (exit 1, no matches).
- `./check` green — lint, 21 test files, build all passed. The `model.test.js`
  progression tests (which cover `buildFinishProgression` / `progressionForItem`) still
  pass, so the finish/routine-progression flow is unchanged.

## Workflow

- No deviation. Single-function deletion exactly as specified; the rest of the
  progression machinery is live and was left as-is.
