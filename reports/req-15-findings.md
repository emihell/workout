# req-15 — improvement findings (observe-don't-do, DEC-021)

Bigger merge / separate / restructure ideas surfaced while migrating, **not acted
on** in req-15. Ranked by value. Grows as later screen-groups are migrated — the
list below is from the **workout-flow** group (`Workout.jsx`).

## Separate

1. **`src/views/Workout.jsx` is oversized (~820 lines).** It holds nine exported
   screens (`Workout`, `WorkoutItem`, `WorkoutItemLog`, `WorkoutItemLive`,
   `WorkoutItemDone`, `WorkoutItemExercise`, `WorkoutFinish`/`FinishScreen`,
   `WorkoutSetup`, `WorkoutSetEdit`), the store-connected `RestBar`, the
   `useRestCountdown` hook, and ~8 helper functions. Split into a
   `views/workout/` folder (one file per screen-group + `rest-bar.jsx` +
   `helpers.js`). **Highest value** — it's the largest view and the in-gym flow
   we iterate on most. Rough size: mechanical move, ~1 session.

## Restructure

2. **Set-log seed/prefill logic lives in a view.** `WorkoutItemLive`
   (`Workout.jsx:390-415`) computes `historyPrefill` / `fromRestore` / `seed` /
   `initialEffort` / `initialNote` — real domain logic (the history-is-truth
   rule) sitting in a component. Extract to a pure `initialSetFields(...)` beside
   `setLogSeed` in `workout-log.js`, unit-tested. Fits the "make the reasoning
   visible / testable" rule. Medium value; ~half a session incl. tests.

3. **The `plannedDone ? itemDonePath : itemLogPath` branch is repeated.**
   `WorkoutItem` (`:235`), `itemSetsPath` (`:206`), `WorkoutItemExercise`
   (`:565`, `:582`). One helper `itemCurrentPath(routineId, item, workout)` would
   dedupe. Low value, tiny.

## Merge / component gaps (touch `src/ui/`)

4. **`Row`'s link variant can't show a right-aligned `value` + chevron.**
   `ui/index.jsx` `Row`: when `to` is set it renders `children + ›` only and
   ignores `value`. The workout overview and item-done lists want *name* left,
   *role/done* right, *chevron* trailing — so the migration had to inline the
   meta into the row text (`Workout.jsx:180`) instead of aligning it. Enhancing
   `Row` to allow `value` on link rows would clean up overview / done / (likely)
   History rows. Medium value; small ui change but check every `Row` call.

5. **No first-class subtitle/caption element.** Many screens are a `Title` + a
   secondary line (routine focus·date, exercise equipment, finish summary). I
   added a `.ui-sub` utility class for this pass; once all screens are migrated
   and the frequency is known, consider a `Subtitle` component or a `subtitle`
   prop on `Title`. Medium-low value; decide after the whole app is migrated.

6. **`ExerciseTitle` + `ExerciseSetupHeader`** (`Workout.jsx:60-85`) are two tiny
   header helpers always rendered together on the live/done screens. Could merge
   into one `ExerciseHeader`. Low value.

## Cross-references (already tracked elsewhere)

7. **Native `window.confirm` / `window.alert`** — `abandonWorkout` (`:31`) and the
   "Pick effort." guard in `completeSet` (`:330`). Out of scope here (req-15 note:
   "native alert/confirm → inline UI" is a separate item). Flagging so the
   inline-dialog req picks up these two call sites.

8. **Shared nav primitives are unstyled** — `Back` (raw `<button>`),
   `ExercisesLink`, `NavLink`, `Missing` in `shared.jsx`. Not a finding: `shared.jsx`
   is **step 5** of this same req. Listed so the workout-flow screens' remaining
   unstyled affordances (the Back button, the Cancel link) are understood as
   pending, not missed.
