# req-154 — a comma kg ("22,5") is saved as 0 on the live log and as null in History

**Status: BUILT — branch `req-154` (`ae81620`), NOT merged.** (2026-09-24) — Phase 1, **bug, data trust**. Gate: functional + independent reviewer (DEC-057 §1
fires if `workout-log`/`store` is touched). Decision already made: **DEC-058 §1 — a comma is a decimal point** (built so far
only in the routine editor, `routine-item-parse.js:50`, and the weight-step field, `weight-step.js:18`). Source: code audit
2026-09-24 **F-TRUST-1** (`audits/2026-09-24.md`), verified by Planner.

## The bug [measured]

The number fields use `inputMode="decimal"` (`ui/index.jsx:135`); on a Swedish iPhone that keypad types a **comma**. Then:
- live log `item.jsx:223` — `weight: isWeightedType(ex.type) ? Number(weight) || 0 : 0` → `Number("22,5")` is NaN → **0 kg
  saved** for the set (and 0 feeds prefill, beat-last-time and progression).
- active set edit `item.jsx:585` — `Number(weight)` → NaN stored.
- History edit `history/edit.jsx:189` and History add set `history/add-set.js:59` — `Number(weight)` → NaN (serialised
  as `null`).
Silent: no error, the set looks logged.

## Scope

1. One shared parse for a typed kg (and any other decimal the log accepts, e.g. a duration if it takes decimals): trim,
   `,` → `.`, then a finite number, else the field's "empty" value. Reuse/extract from `weight-step.js` /
   `routine-item-parse.js` rather than a fourth copy.
2. Use it at all four sites above, and grep for any other `Number(weight)` / `Number(…kg…)` on a typed value.
3. A typed value that isn't a number ("abc", "2,5,5") is **not** silently saved as 0: the form refuses to Complete/Save and
   says so inline (same style as the routine editor's error), or — if a site has no error slot — keeps the field empty.
   Builder's call which, per site; say which.
4. **Existing data is not rewritten.** Sets already saved as 0 or null from a comma can't be told apart from a real 0 /
   blank. No migration, no bulk write (ask-gate #2). Note in the report how many weighted work sets with weight 0 exist in
   the dev data, for Emilio's information only.
5. Commit `audits/2026-09-24.md` (the code audit, provided by Planner at the path in the ping) as the branch's first
   commit, unchanged.

## Out of scope

The other audit findings (F-TRUST-2 warm-up rpe, F-RISK-5 import-while-unreadable, debt) — Emilio's calls first.

## Acceptance criteria (written before implementation)

- Unit: "22,5" → 22.5 and "22.5" → 22.5 at each of the four save paths; " 20 " → 20; "" → the site's empty value.
- Failure case: "abc" / "2,5,5" is never saved as 0 or NaN (test per site, per the chosen behaviour).
- A grep of `src/` (tests excluded) shows no `Number(` applied directly to a typed weight (paste it).
- Browser: log a set typing `22,5` → the stored set has `weight: 22.5`; History edit to `17,5` → 17.5 (paste the stored
  values).
- `./check` green (paste the line). Test edits called out.
