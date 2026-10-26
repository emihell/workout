**Status: READY** · **Lane: ui** · batch 7 (J8). One routine item edited through the normal path; no bulk write.

# req-242 — a workout's exercise row opens its editor; the editor can change the exercise

Emilio, 2026-10-22 (scheduled workout screen): "Clock on exercise to change it or edit delete" (click). No E decision against
(PAGES.md, Workouts list and a workout's own screen) → Planner's fix (DEC-137).

## Code facts (rescanned 2026-10-26, `main` 103678a)

- Rows: `RoutineDetail` (`views/Routine.jsx:208`), each row a plain `Row` with only the name as a `NavLink` to the item editor
  (`:249-273`). `ScheduleSlot` renders the same screens (`views/Schedule.jsx:367-425` → `RoutineScreens`), so one change covers
  the Workouts list's workout screen and the scheduled-workout screen.
- `Row` with `to` makes the whole row the link (`ui/index.jsx:261-275`); with `action` the control sits beside it.
- Item editor `RoutineExerciseEdit` (`Routine.jsx:602-650`): fields + Save (`store.updateRoutineExercise(routineId, index,
  patch)`) and Remove (`:642-647`). No way to change the exercise.
- History's prescription: `historyPrescription(workouts, exerciseId)` (`history-queries.js:229`), used when adding
  (`state-reducers.js:141`, DEC-097 §4).

## Scope

1. The whole row (name + meta) opens the item editor (`Row to=`). In Reorder mode rows stay non-links with Up/Down.
2. The item editor gets **"Change exercise"** → the routine's whole-library picker in single-pick mode (same picker as
   Add, DEC-097 §1; picking a library entry creates the user's exercise as today).
3. On pick, the item keeps its id, note, role and warm-up switch, and gets:
   - the new exercise has history → history's prescription (sets, reps, rest, kg), as Add does;
   - no history → keeps the item's sets, reps and rest; **kg blank** (DESIGN §1, DEC-106's pattern).
   Then back to the item editor showing the new exercise.
4. Finished history and an in-progress workout's snapshot are untouched.

## Out of scope

- Mid-workout Swap (already exists); multi-pick; changing several items at once.

## Acceptance criteria

1. Tapping the meta line (not the name) of a row opens the item editor.
2. Change exercise → pick an exercise **with** history → the item shows history's sets/reps/rest/kg; the routine stores the
   new `exerciseId` with the same item id.
3. **Failure case:** pick an exercise with **no** history → sets/reps/rest kept, every kg blank (assert `suggestedWeights`
   holds no number carried from the old exercise).
4. A finished workout that used the old exercise still shows it in History; an active workout's snapshot is unchanged.
5. `./check` green.

## Decisions made on Emilio's behalf

- History → full prescription; no history → keep sets/reps/rest, kg blank `(unconfirmed)` — behaviour (mirrors DEC-104/106).
- Label "Change exercise", placed above Remove `(unconfirmed)` — behaviour (copy).

## READY checks

1 DECs: DEC-096 §2, DEC-097, DEC-104, DEC-106. 2 Siblings: none in flight on `Routine.jsx`. 3 None. 4 None.
5 Trigger files: if a reducer is added in `store.jsx` / `state-reducers.js` → **independent reviewer**; one record via the
normal edit path → no backup reminder. 6 Marked.
