# req-188 — Swap and Skip exercise move to the workout list; Add exercise; whole-library picker

**Status: READY** (2026-10-05). **Lane: ui.** From DEC-103 §2 and §4 (req-184 feedback F3, F5). Siblings: after
**req-186** and **req-187** (all edit `views/workout/item.jsx`). Trigger files: `store.jsx` / `state-reducers.js` /
`workout-log.js` (a new add-item reducer) → **independent reviewer** before merge; writes only the active workout and, for a
library pick, a new exercise record (as the routine picker does) — no bulk write, no schema change.

## What Emilio said
- F3 (09-29) "Two skip buttons, swap should not be here, it should be on the rutine page before this page, becouse you dont
  start an exercise then swap - and should it be swap? Why not just add?"
- F5 (10-05) "I should be able to search in the whole library" (on the Swap screen)
- 2026-10-05: "i think its hard to know you can swap, when its inside a ex, so its better thats in the list instead"

## Code today (main `cbd9a78`)
- Log screen, below the form (`item.jsx:500-517`): Remove set (conditional), **Skip exercise** (two taps, `skipExercise`
  `:316-325`), **Swap exercise** (NavLink to `/replace`). Bottom bar (`ui/index.jsx:522-527`): Previous · **Skip** ·
  Complete — hence two Skips.
- Overview rows (`overview.jsx:156-173`): `Row to={path}` only; `Row` ignores `action` when `to` is set
  (`ui/index.jsx:212-232`). No mid-workout add (`overview.jsx:106` "Add exercises" only on an empty preview).
- Swap screen `replace.jsx:40-44` searches `store.exercises` only; pick → `store.replaceItem` (`store.jsx:180-189` →
  `replaceItemInState` `state-reducers.js:120`): original's remaining sets skipped, `replacementItem`
  (`workout-log.js:225-247`) inserted after it with **sets: 1**, `suggestedWeights` = history's first kg, `addedMidWorkout`.
  A done item can't be swapped (bounce, `replace.jsx:31-33`).
- Routine picker `views/ExercisePicker.jsx`: own (recent first) → whole library, `onPick` mode writes nothing and returns
  `{kind:'own'|'library', …, item}` with the history-or-starting-plan prescription; `max: 1` = single pick. `Plan.jsx:92`
  uses `onPick` and then creates the record (`store.addExercise`, `store.jsx:132`).
- BACKLOG (req-109 follow-ups): "A replacement starts with 1 set (a 3-set swap costs 6 extra taps)".

## Scope (ordered)
1. **Overview row actions.** Each not-done row gets a small "⋯" control (its own tap target, outside the row link) that
   opens a sheet: **Swap exercise** · **Skip exercise** · Cancel. Skip exercise in the sheet is one tap (the sheet is the
   guard; today's two-tap arm goes). Done rows: no "⋯".
2. **Log screen:** remove Skip exercise and Swap exercise; keep Remove set. Bottom bar's Skip reads **"Skip set"**.
3. **Swap screen uses `ExercisePicker`** (`max: 1`, `onPick`): own exercises first, then the whole library. A library pick
   creates the user's exercise record (as `Plan.jsx` does), then swaps. Back from Swap → the overview.
4. **The swapped-in item takes the picker's prescription** (sets, reps, rest, kg — history, else the shown starting plan),
   not 1 set. Still `addedMidWorkout`, still this workout only.
5. **"Add exercise"** at the bottom of the overview list (above Note/Finish): same picker, multi-select allowed; each pick
   is appended to the snapshot as a mid-workout item with the picker's prescription. The routine is never touched (the
   req-187 offer stays null for `addedMidWorkout`).

## Out of scope
- Reordering exercises. Adding to the routine from the workout. Pill/set list (req-186), the kg confirm (req-187).
- A swap of an exercise that already has logged sets keeps today's rule (remaining sets skipped, logged ones kept).

## Acceptance
1. Browser: overview, "⋯" on an untouched row → Swap → search "landmine" (a library-only entry) → pick → new exercise in
   `exercises` (receipt), the row replaced by it with the picker's sets count (not 1), original reads "skipped".
2. Browser: "⋯" → Skip exercise → row reads "· skipped", one tap after the sheet.
3. Browser: Add exercise → pick 2 → both appended at the end, each opens its log screen; routine in localStorage
   unchanged (receipt: routine item count before/after).
4. Log screen: exactly one Skip control ("Skip set"); no Swap/Skip exercise (screenshot 390×844).
5. **Failure case:** the library fails to load in the picker → own exercises still listed, "Could not load." for the
   library part (the picker's existing `loadCatalog` failure path), swap of an own exercise still works.
6. **Failure case:** a near-duplicate library pick ("Bench" vs own "Bench Press") → the picker's existing "Use your …?"
   guard fires; no duplicate record.
7. Unit: add-item reducer — appends, `addedMidWorkout: true`, unknown exercise → state unchanged; existing replace tests
   still pass (any test edit called out).
8. `./check` green; the reviewer's verdict quoted.

## Decisions made on Emilio's behalf
- behaviour `(unconfirmed)`: the "⋯" + sheet shape; Skip exercise one tap inside the sheet; "Skip set" label; swapped-in
  item takes a full prescription; Add exercise at the list bottom; multi-select on Add, single on Swap.
- implementation: the add reducer's home; sheet component (shared with req-187 if it fits).
