# req-60 — Front page reads chronologically (upcoming preview reversed)

## Technical

- **Change:** `src/views/Today.jsx` line ~209 — appended `.reverse()` to the
  upcoming preview:
  `const upcoming = remainingInLoop(routines, schedule, now).slice(0, 2).reverse()`.
  Added a `req-60` comment explaining the render-time flip.
- **Effect:** the upcoming column now renders furthest-future at the top and
  nearest just above the today hero (dates decreasing top→bottom), matching the
  recent peek (already descending) so the whole front-page column reads
  chronologically: future → today (hero, middle) → past.
- **Still the two soonest workouts:** `slice(0, 2)` is unchanged; only the
  vertical order of the shown items flips.
- **Shared helpers untouched:** `remainingInLoop` (`src/schedule.js`) stays
  ascending and `sortWorkoutsByDate` (`src/views/history/helpers.js`) stays
  descending — other callers depend on those orders. Confirmed by empty diff on
  both files (`git diff main -- src/schedule.js src/views/history/helpers.js`).
- **Edge cases:** 0 upcoming → `[].reverse()` is `[]`, "Nothing scheduled." still
  shows (guard unchanged); 1 upcoming → reverse of one item is itself.
- **Diff scope:** `git diff --stat main` shows only `src/views/Today.jsx`
  (5 insertions, 1 deletion).
- **Gate:** `./check` green — `check: green — lint, 18 test file(s), and the build
  all passed.` (213 tests pass, 0 fail).

## Workflow

No deviation from the plan. Implementation matched the requirement's suggested
approach (render-time `.reverse()` in `Today.jsx`). No scope added or dropped, no
mid-build decisions needed, nothing for a new DEC-/L-.
