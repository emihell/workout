# req-15 — improvement findings (observe-don't-do, DEC-021)

Bigger merge / separate / restructure ideas surfaced while migrating the **whole
app** onto `ui/`, **not acted on** in req-15. Ranked by value. These become the
follow-up cleanup req(s) Emilio specs after review.

## High value

1. **Split the two oversized view files.** `Workout.jsx` (~820 lines, 9 screens +
   RestBar + `useRestCountdown` + ~8 helpers) and `History.jsx` (~660 lines, 9
   screens + date/month grouping + `addSetToWorkout`). Each should become a
   folder (`views/workout/`, `views/history/`) with one file per screen-group and
   a helpers module. Mechanical, high payoff on the files we touch most.

2. **Merge the three set-editing forms into one component.** `WorkoutSetEdit`
   (`Workout.jsx`), `HistorySet` (`History.jsx`), and the live `SetLogForm` all
   edit kg / reps / effort / note with small differences (HistorySet adds a
   set-type toggle; the live form adds skip/previous + seeding). At minimum
   `WorkoutSetEdit` and `HistorySet` are near-duplicates and could share a
   `SetEditForm`. Medium-high value; reduces the most-duplicated surface.

3. **Extract the set-log seed/prefill logic out of the view.** `WorkoutItemLive`
   (`Workout.jsx`) computes `historyPrefill` / `fromRestore` / `seed` /
   `initialEffort` / `initialNote` — the history-is-truth rule living in a
   component. Move to a pure, unit-tested `initialSetFields(...)` beside
   `setLogSeed` in `workout-log.js`. Fits the "make the reasoning testable" rule.

## Medium value (mostly ui/ component gaps)

4. **`Row` can't show a right-aligned `value` next to a link chevron.** When `to`
   is set, `Row` renders `children + ›` and ignores `value`. Overview / history /
   month rows had to inline their meta into the row text instead of aligning it
   right. Let link rows carry a `value`. Touches every `Row` call — verify all.

5. **Formalize the "row with a trailing action button" pattern.** It recurs a lot
   — Today (`Start`/`Resume`/`Done`), Start drafts, Schedule day (`Remove`) and
   add (`assign`), Routine detail (`Up`/`Down`), Exercise search (`Add`). All are
   done by stuffing a `<Button>` into the `Row` `value`. An `ActionRow` (or a
   documented convention) would make these consistent.

6. **No first-class subtitle/caption element.** Nearly every screen is `Title` +
   a `.ui-sub` line (I added `.ui-sub` as a utility this pass). Now that the
   frequency is clear (~all screens), consider a `Subtitle` component or a
   `subtitle` prop on `Title`.

7. **`SegmentedControl` "clearable" via a leading `—` option** is hand-rolled in
   three places (`WorkoutSetEdit`, `HistorySet`, `HistoryEdit` feel). A
   `clearable` prop (or an explicit "none" affordance) would remove the repeated
   `[{value:'',label:'—'}, ...opts]` idiom.

## Lower value

8. **`Select` was a missing primitive** — added this pass (native select styled
   like `Field`, grayscale caret). Noted here only so the follow-up knows the
   library grew by one component; nothing to change.

9. **Repeated `plannedDone ? itemDonePath : itemLogPath` branch** in `Workout.jsx`
   (`WorkoutItem`, `itemSetsPath`, `WorkoutItemExercise` ×2) → one
   `itemCurrentPath` helper. Tiny.

10. **`ExerciseTitle` + `ExerciseSetupHeader`** (`Workout.jsx`) are two tiny
    header helpers always rendered together → could merge to one `ExerciseHeader`.
    Tiny.

## Cross-references (tracked elsewhere, not for this cleanup)

11. **Native `window.confirm` / `window.alert`** now appears across the migrated
    app — delete routine/exercise/workout/set/slot, abandon, loop-weeks removal,
    the "Pick effort." guard, import errors (~10 call sites). Out of scope here
    (the req-15 note names "native alert/confirm → inline UI" as a separate item).
    Listing the count so that req is sized correctly; the `Banner` component is
    already the natural home for the inline version.
