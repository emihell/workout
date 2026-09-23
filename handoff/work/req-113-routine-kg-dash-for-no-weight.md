# req-113 — routine editor shows "—", not "0", for a set with no weight (DEC-056 correction)

**Status: SPEC — READY, held for Emilio's go.** Phase 1. **[ux-feel]** Display only: `src/ids.js`. No stored
data changes.

Emilio, 2026-09-23 (confirming Planner's call): show `—`, never a number, for a set the routine has no
weight for.

## Why

[measured] `routineItemMeta` (`src/ids.js`, req-103) prints the kg part when **some** suggested weight is
above 0, and joins **all** of them: `[0, 40]` → `0/40 kg`. A `0` in `suggestedWeights` means "no weight"
(req-112's recalc records it for a skipped hole, and older data can hold it too), so printing `0` shows a
weight the app doesn't have (DESIGN §1).

## The behaviour

- In the routine editor's meta line, a weight that is `0`, empty or missing shows as `—`:
  `[0, 40]` → `—/40 kg`, `[40, 0, 45]` → `40/—/45 kg`.
- All-zero or empty → no kg part, as now.

## Scope

`routineItemMeta` in `src/ids.js` + `src/ids.test.js`.

## Out of scope

What's stored; `targetWeight` on logged sets; every other screen.

## Acceptance criteria

- **Unit:** `[0, 40]` → meta contains `—/40 kg`; `[40, 0, 45]` → `40/—/45 kg`; `['', 40]` → `—/40 kg`.
- **Failure case (unit):** `[0, 0]` and `[]` → no kg part (existing req-103 tests unchanged).
- **No regression:** `./check` green.

## Decisions

- `—` for no weight (Emilio, 2026-09-23).
