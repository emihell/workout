# req-156 — warm-up/cardio sets stop saving a hidden effort; a render-test harness for views

**Status: BUILT AND MERGED, 2026-09-24 — branch `req-156` (`6cccc57`…`b1d0b41`, 3 commits).** (2026-09-24) — Phase 1 bug + test infra. DEC-085 §1, §10. Gate: functional + reviewer (DEC-057 §1 if
`workout-log`/`store` is touched). **No bulk write:** rows already saved with `rpe: 3` stay as they are.

Source: `audits/2026-09-24.md` **F-TRUST-2** and **F-TEST-1** (read both sections; the audit rendered `SetLogForm` with
~20 lines of setup).

1. **F-TRUST-2.** `SetLogForm` submits `effort` even when the Effort control is hidden (`ui/index.jsx:417,441,461`), so a
   warm-up or cardio set stores `rpe: 3` and History shows "WU set · … · Moderate". **Fix:** when Effort isn't shown, the set
   stores `rpe: null`, at every save path (live log, active set edit, History edit/add set). History shows no effort for
   such a set. Existing rows untouched; say in the report whether History should hide "Moderate" on old warm-ups too —
   **don't** build that (it would be a display rule over old data; Emilio's call).
2. **F-TEST-1.** A harness so `node --test` can render `.jsx` components (the audit's approach or better; avoid the
   deprecated `react-test-renderer` if a light alternative works). Wire it into `./check`. Prove it with render tests for
   `SetLogForm`: effort hidden → onComplete gets `rpe` null/absent; effort shown → the picked value.

## Acceptance criteria

- Render test (new harness): warm-up and cardio submit no effort; a work set submits the picked effort. Show it failing on
  main.
- Unit tests at each save path: warm-up/cardio → `rpe: null`.
- Browser (isolated origin): log a warm-up set → stored `rpe: null`; History shows no "Moderate" for it (paste).
- `./check` green including the render tests (paste). No existing test weakened.
