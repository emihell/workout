# req-155 — decimal leftovers from req-154's review

**Status: BUILT — branch `req-155` (`198fbd3`), NOT merged.** (2026-09-24) — Phase 1, small bug. Gate: functional (unit + browser). No persisted-data change.
Source: req-154's independent reviewer (SHIPPED req-154). DEC-058 §1 (a comma is a decimal point).

1. **A trailing separator is refused** — `kg-input.js:10` `KG_NUMBER` rejects "22," and "22."; on main before req-154 "22."
   saved as 22. A person who types "22," and taps Complete meant 22. **Fix:** accept a trailing `,` / `.` as the whole
   number (like `weight-step.js:13` already does); "2,5,5", "abc", negatives stay refused.
2. **A comma duration is saved as 0** — a timed set's duration `ui/index.jsx:451` `Number(duration)||0` ("30,5" → 0), and
   the exercise default duration `Exercises.jsx:411` ("30,5" → falls back to the default). **Fix:** the same parse
   discipline for seconds — a comma reads as a decimal point, rounded to whole seconds (Planner's call, unconfirmed: round
   half up), or an inline error if unreadable; never a silent 0.

## Acceptance criteria

- Unit: "22," → 22, "22." → 22 at the four set-save sites; "2,5,5" still an error. Duration "30,5" → 31 (or the chosen
  rounding), "abc" → error, "" → the site's empty value.
- A grep of `src/` for `Number(` on a typed duration/kg value (tests excluded) → none (paste).
- Browser: a timed set with "30,5" stores 31 s; "22," on the live log stores 22 (paste the stored values).
- `./check` green (paste). No existing test weakened.
