# req-201 — UI vocabulary: routines are "Workouts"; a session is named by its workout and date

**Status: READY** (2026-10-07). **Lane: ui.** From DEC-110 §2 and review F9/F13/F18. Last of the structure reqs (after
req-200), so the strings are counted on the settled screens.

## Code today
The review's string list (main `166266a`, `work/req-196-app-organisation/review.md` F9). **Rescan at build**: req-198 to
req-200 delete and move some of these.
- **Session meaning:**
  - `Today.jsx:277` "Start new workout"
  - `workout-actions.js:12,98`
  - `state-reducers.js:184-186`
  - `Settings.jsx:11` (import summary)
  - `auto-complete.jsx:97` "This workout"
  - `error-boundary.js:54`
  - `history/detail.jsx:95`
- **Routine meaning:**
  - `model.js:185` "Deleted routine"
  - `history/helpers.js:52`
  - `recalc.jsx:30`
  - `routine-update-offer.js:54`
  - `Routine.jsx:42,112,140,214-216`
  - `Exercises.jsx:324,488`
  - `Schedule.jsx:70,88,144,158`
  - `Plan.jsx:166`
  - `Today.jsx:342,368`
  - the bar labels
  - the `exchange.js:11-62` assistant prompt
- **Already "workout" for the plan:** `Plan.jsx:287,291`, `plan-templates.js:140` ("My workout A/B").

## Scope
1. **Every user-visible "routine" → "workout".** Examples:
   - "Add workout", "Update workout?", "Not in this workout yet".
   - The bar's left label → "Workouts".
   - The Home oval → "Today".
   - Default plan names → "Workout A" / "Workout B" (no "My").
2. **Every user-visible generic "workout" meaning the session** becomes:
   - its name and date, where one is in hand ("Abandon Upper Body?", "Delete Upper Body · 6 Oct?");
   - otherwise "session" ("Starting a new session will abandon the one in progress"; import summary "… N sessions") `(unconfirmed)`.
3. **Routine delete confirm** (`Routine.jsx:214-216`): name the days ("removes it from Mon and Thu"), not "schedule slots"
   (F18).
4. **No internal renames.** Code identifiers, routes (`/routines` stays, F13), storage keys, export field names, and the README
   entity stay as they are. Add one glossary line to `README.md`: "UI: Workout = routine (the plan); a logged session is shown
   by name and date."
5. **A static test** greps rendered UI strings (JSX text and string literals in `src/views`, `src/ui`, `App.jsx`) for
   `/\broutines?\b/i`, with an allow-list for code-only uses.

## Out of scope
- Route or identifier renames.
- The assistant prompt's internal field names (keep the prompt's text consistent with the glossary).

## Acceptance
1. The static test passes, and fails if "Add routine" is reintroduced (run it once with a planted string and paste both
   outputs).
2. Browser: Workouts tab, routine detail, Home, the abandon confirm and history delete show no "routine", and no "workout"
   used for a session.
3. **Failure case:** the import summary on a backup with 3 routines and 13 workouts reads "3 workouts … 13 sessions", never
   "workouts" twice.
4. `./check` green. The smoke test passes (update its text selectors, and name them).
