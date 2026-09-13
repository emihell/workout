# req-58 — Routine-row Start is secondary

## Technical

Changed the routine-row Start button in `src/views/Routine.jsx` `Routines()`
(line 60) from `variant="primary"` to `variant="secondary"`. `onClick`
(`startOrContinue(store, routine.id)`), position (right of Edit), and label
unchanged. The today hero's Start was not touched. No other primary button on
the row, so nothing on it is ink-primary.

Acceptance criteria:
- **Start is secondary:** diff shows the single `primary` → `secondary` swap on
  the routine row's Start; renders `ui-btn--secondary`.
- **Still starts:** `onClick` unchanged — still `startOrContinue(store, routine.id)`
  (incl. req-55 abandon-on-new path).
- **No regression:** `./check` green —
  `check: green — lint, 18 test file(s), and the build all passed.` (213 tests, 0 fail).

## Workflow

No deviation. One-line variant change exactly as specified; no scope added or
dropped, no mid-build decisions.
