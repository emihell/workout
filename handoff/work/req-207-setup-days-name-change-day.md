# req-207 — first setup: pick your days, name it last ("New workout #N"); a day's workout can "Change day"

**Status: READY** (2026-10-07). **Lane: ui.** From DEC-116 and Lena run 3 (setup picked Wed/Sat; she wanted Tue/Fri;
"Workout" collided everywhere). **Emilio sees screenshots before merge (L-050):** the days/name step and a day screen.

## Code today (main `8d9e676`)
- **Machines-first setup:** `views/Plan.jsx` `RoutineMachines` (`:336`) → `MachinesDays` (`:263`).
  - Choices: days count, then "Same workout every time" / A/B (`:287`).
  - Preview line from `plan-templates.js:108-118`: "Starts today (Tue), then every Tue and Fri".
  - Save at `:327`.
- **Plan shape:** `machinesPlan({days, split, picks})` (`plan-templates.js:~134-145`). Names come from `names = ab ?
  ['Workout A','Workout B'] : ['Workout']`. The week comes from `PLAN_TEMPLATES[days].week` (weekday list, `:28-46`),
  shifted by `startTodayWeek`.
- **"Blank workout"** is at `views/Routine.jsx:130-143`, and `store.jsx` falls back to the name "Workout".
- **Slot ops:** `store.addSlot({week, weekday, routineId})` (`store.jsx:105`) and `store.removeSlot(slotId)` (`:130`).
- **The day screen** is `views/Schedule.jsx` `ScheduleDay`, with req-203/204's date, done rows and Start now.

## Scope
1. **Pick the days.**
   - In `MachinesDays`, after the days count is chosen, show 7 weekday chips (Mon–Sun) with the template's suggested days
     preselected.
   - Tapping toggles a day, and exactly `days` must be selected before Save is enabled. A hint reads "Pick 2 days".
   - The preview line updates from the chosen days. The plan's week uses the chosen weekdays, in Mon–Sun order. A/B
     alternates A, B over them in that order.
   - DEC-105 still holds: the plan starts today if today is chosen.
2. **Name last.**
   - Just above Save: a "Name" field, two ("Name A", "Name B") with A/B, prefilled "New workout #N" (and #N+1).
   - N is the smallest integer ≥ 1 such that no active workout is already named "New workout #N".
   - An emptied box falls back to its prefill on Save.
   - `machinesPlan` takes the names, and stays pure and tested.
3. **The same default for "Blank workout"** and for any other place that creates a workout without a typed name
   (`store.jsx`'s "Workout" fallback).
4. **Change day.**
   - On the day screen, each scheduled workout row gets **"Change day"**. It opens a small picker of the 7 weekdays, with
     the current one marked.
   - Choosing a day: `removeSlot` that slot, then `addSlot` with the same week, the new weekday and the same routine. Then
     land on the new day's screen, keeping `from` and the date logic if it is in range.
   - A confirm-free action, since it is reversible by changing it back.
   - In a loop longer than 1 week it stays in that loop week.

## Out of scope
- One-date overrides (schema).
- The slot-template plan (`RoutinePlan`/`Fill`) beyond its default names.
- Renaming existing workouts.

## Acceptance
1. **Unit `machinesPlan`:** with days 2, chosen Tue + Fri, and A/B, the week is `[[2,0],[5,1]]` and the names are the
   provided ones. The N computation, with existing "New workout #1" and "#3", gives 2.
2. **Browser, empty origin:**
   - Pick 6 machines → 2 days → untick Wed, tick Tue → A/B → names prefilled "New workout #1" / "#2" → change #1 to "Legs" →
     Save.
   - Receipt from v9: routines named "Legs" and "New workout #2", slots on Tue/Fri.
   - Screenshot of the step to `/private/tmp/claude-501/-Users-emiliohellberg-projects-workout-workout-planning/a2f9aeb8-ef44-4bb9-9b4b-171a32f002ca/scratchpad/r207-setup.png`.
3. **Failure case:** with 3 days selected for a 2-day plan, Save is disabled and the hint shows. With 1 selected, the same.
4. **Browser:**
   - Home → a day with a workout → Change day → Saturday. v9 `schedule.slots` has that routine on weekday 6 and not on the old
     day, the slot count is unchanged, and the History count is unchanged.
   - Screenshot of the day screen to `.../scratchpad/r207-day.png`.
5. `./check` green. **This branch's own** smoke is green on the committed sha (L-049).
