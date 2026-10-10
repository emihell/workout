**Status: BUILT, NOT merged** **Lane: ui** — display only; reads workouts, writes nothing.

# req-213 — a workout done earlier in the week covers its next spot

DEC-119 §2 (Emilio, H3: "i did lower body on tuesday, and usually that is for thursday, so if i already did it, remove it from
thursday"). Builder: throwaway agent (settled, DEC-055).

## Facts (rescanned 2026-10-10, `main` 25d366a)

- Done for a spot = `coveringWorkout(workouts, routineId, date, slotId)` (`schedule.js:140-171`): same routine, matched by slot +
  `scheduledFor` / `occurrenceId`, legacy by finish date.
- Home "Coming up" = `comingDays` (`schedule.js:179-186`), no done check. Today's block: `views/Today.jsx:110-132`. Day screen:
  `doneOnDay` by finish date, `startNowShown` (`schedule-day` helpers, per rescan `views/Schedule.jsx` / `schedule-day.js:39-54`).
- Weeks are Monday-based (`mondayOf`, `schedule.js:20`).

## Scope

1. New pure helper (`schedule.js`), e.g. `doneEarlier(workouts, routineId, date, slotId, schedule)`: for a spot (routine R, date D)
   with **no** `coveringWorkout`, return the earliest finished workout of R whose finish date is in `[mondayOf(D), D)` and which
   does **not** already cover another spot of R that week (each workout covers at most one spot). Else null.
2. Where it returns a workout, that spot shows **"Done {Weekday} ✓"** (e.g. "Done Tue ✓", linking to that session) in place of its
   Start / plain row:
   - Home today's block (the spot is today),
   - Home "Coming up" rows (the workout name gets "· Done Tue ✓"),
   - the day screen's row (Start now hidden, as for a covered spot).
3. Nothing is stored; the schedule is unchanged; next week the spot is back.

## Out of scope

Moving or deleting the spot; covering across weeks; a workout of a *different* routine covering it; any setting.

## Acceptance criteria

1. Unit: Lower body scheduled Tue + Thu; finished Tue with Tue's slot → Thu has no cover (Tue's workout covers Tue).
2. Unit: Lower body scheduled Thu only; finished Tue off-schedule → Thu returns that workout; the following week's Thu returns null.
3. Unit: finished on the **previous** Sunday → Thu (Mon-based week) returns null.
4. **Failure case — one workout, two later spots:** scheduled Wed + Fri, one off-schedule workout Mon → Wed is covered, Fri is not.
5. **Empty input:** no workouts / archived routine → null, Home renders as today.
6. Browser: seed a Tue off-schedule finish of a Thu workout, Home on Wed shows Thu "· Done Tue ✓"; on Thu, today's block shows
   Done Tue ✓ and no Start.
7. `./check` green.

## Decisions made on Emilio's behalf

- **behaviour** `(unconfirmed)`: the spot stays visible as "Done Tue ✓", not removed (Emilio said "remove"; Planner recommended
  showing why, Emilio: "sounds good").
- **behaviour** `(unconfirmed)`: the week is Mon–Sun (the schedule's own weeks); a workout covers only the nearest later spot.
- **behaviour** `(unconfirmed)`: a spot covered this way has no Start on Home or its day screen (as a covered spot today);
  "Start a workout" (off-schedule) stays.

## READY checks

1. DECs: DEC-105, DEC-113/114 (Home), req-200 "Done shows by date", DEC-117 §2 one-date moves (`slotsOn` already applies moves —
   the helper takes dates from it, so a moved spot is judged on its moved date).
2. Siblings: req-214 edits Today.jsx's done line (build 214 after 213, or rebase). 3. none. 4. none. 5. no trigger files. 6. marked.
