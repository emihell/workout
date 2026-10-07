> **Layout superseded by DEC-113 / req-204** (Emilio: "the front screen is now very busy"). The day screen stays.

# req-200 — Home shows this week: today first, then Mon–Sun with rest days; a day opens its schedule screen

**Status: BUILT AND MERGED, 2026-10-07 — branch `req-200` (`a630477`…`433f384`, 2 commits).** (2026-10-07). **Lane: ui.** From DEC-110 §4 and review B1/F2–F6. Builds after req-199. Touches
`views/Today.jsx`, `views/Schedule.jsx` (ScheduleDay) and `schedule.js` (a pure week helper).

## Code today (main `166266a`)
- **Home** (`views/Today.jsx`), top to bottom:
  - 2 upcoming rows, furthest first, each with Start (`:86-107`, `:294`).
  - Today's block: hero / TodayWorkouts / TodayEmpty, with done-today rows (req-195).
  - The stale in-progress Continue row (`:326-329,423-428`).
  - 2 recent rows → History.
- **Schedule slots** are `{id, week, weekday, routineId}`. The loop is 1–4 weeks (`schedule.js:44-50,82-86`). A day can hold
  several slots. A slot's done state is matched by slot id (`schedule.js:102-132`, `coveringWorkout` by finish date).
- **`ScheduleDay`** (`Schedule.jsx:110-148`):
  - Title "Monday" (+ " · week N" when the loop is longer than 1).
  - Slot rows with Remove.
  - "Add routine ›".
  - `<Back to="/schedule">`.
- **Measured** (review F4, 390×844 seeded): row height 61, today block 122, dock top 764.

## Scope
1. **Home order:**
   1. Title.
   2. **Today's block** exactly as now (hero / workouts / empty / done-today, Start). The stale Continue row stays with it.
   3. **"This week"**: 7 compact rows Mon–Sun for the current calendar week.
   4. The recent rows / History as now.

   The 2 upcoming rows go.
2. **Each week row** reads: weekday + date · routine names joined ", " or "Rest" · "Done ✓" if a workout finished that
   date (by date: `completedOnDayKey`, not slot id, review F2).
   - Today's row is marked (bold or "Today") and has no Start; the block above has it.
   - The rows carry no Start.
3. **Tapping a week row** → that date's `ScheduleDay` (its loop week and weekday from a pure helper). That screen gets:
   - **"Start now"** for each slot, which starts that routine today. Start-ahead is kept at 2 taps.
   - A title honest about the loop: "Saturday" in a 1-week loop, "Saturday · week 2 of 2" otherwise.
   - When the loop is longer than 1 week: a **"Whole plan ›"** link to `/schedule` (review B1).
   - Back → wherever it came from (`?from=/` from Home, `/schedule` otherwise).
4. **New pure helper** in `schedule.js`: `weekRows(schedule, workouts, today)` → 7 `{dateKey, week, weekday, slots, done}`.
   Unit-tested, including a 2-week loop and a day with 2 slots.

## Out of scope
- A sheet component.
- "Just this date" overrides (a schema change, DEC-110 §5).
- Renaming (req-201).

## Decisions (unconfirmed, on Emilio's list)
- Week runs Mon–Sun.
- Today's block stays above the week.
- Upcoming rows and their Start go; Start-ahead lives on the day screen.

## Acceptance
1. Unit: `weekRows` in a 2-week loop (Sat A in week 1, Sat B in week 2) returns B for Sat 2026-10-10 and A for 2026-10-17.
   A day with 2 slots returns both.
2. Unit: Monday done, then Monday's slot removed and re-added → Monday's row is still "Done" (by date).
3. Browser at **375×667, clock on a Sunday**: today's Start is fully visible above the dock without scrolling (receipt:
   bounding box vs the dock's top).
4. **Failure case:** in a 2-week loop, a week-2 day's screen says "week 2 of 2". Removing its slot leaves the week-1 same
   weekday's slot in v9 (receipt: `schedule.slots`).
5. Browser: Home → tomorrow's row → Start now → a workout starts. Receipt: `activeWorkout.routineId`.
6. `./check` green. The smoke test passes; update it if it used the upcoming rows.

## Built — calls `(unconfirmed)`
- **"Start now"** is an untagged start (`startOrContinue`), the same as the Workouts list's Start. Thursday trained on
  Wednesday shows "Done" on Wednesday (by date) and leaves Thursday open. Tagging the slot would claim an occurrence that isn't
  one.
- "Whole plan ›" is hidden when Back is `/schedule`.
- **Today's row** is bold, with "Today"; when done it reads "Today · Done ✓".
- Week rows are one line each, under a "This week" header.
- **The stale Continue row** is always shown right under today's block.
- **`ScheduleDayAdd`** follows `from`.
- `remainingInLoop` is deleted (no callers).
- **Loose end:** a slot detail page opened from the day screen goes Back to the plain day path, whose Back is `/schedule`,
  not Home. It goes into req-202.
