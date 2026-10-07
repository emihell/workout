# req-204 — Home: next 3 workouts above, today at the bottom; the week list and past rows go

**Status: READY** (2026-10-07). **Lane: ui.** From DEC-113. Replaces req-200's Home layout. The day screen from req-200 and
req-203 stays.

## Code today (main, after req-203)
- **`views/Today.jsx`:**
  - Home renders, in order: "Workouts ›", today's block, the stale Continue row, "This week" (`weekRows(schedule, workouts,
    now)`, `:295`, `:411`), the recent peek (`HistoryPeekRow`, `:72`, `:322-430`), "History".
  - Week rows link `/schedule/:week/:weekday?from=/`.
- **`views/schedule-day.js` `homeDayDate`** gives a day screen its date only when the date falls in **this** Mon–Sun week.
  Upcoming rows can fall in next week, so that rule must change.
- **`schedule.js`:** `slotsOn(schedule, date)`, `loopWeekIndex`, `addDays`, `dateKey`, `weekRows` (`:142`).

## Scope
1. **New pure `upcomingWorkouts(schedule, routines, today, n = 3)`** in `schedule.js`. It returns `[{dateKey, week, weekday,
   slots}]` for the next `n` dates after today that have at least one slot with an active routine.
   - It scans forward at most `loopWeeks × 7` days, so an empty plan returns `[]` quickly.
   - A day with 2 workouts is one row, names joined ", ".
2. **Home order, top to bottom:**
   1. Title + "Workouts ›".
   2. **"Coming up"** header + rows, **furthest first**. Each row is "{weekday short}, {date} · {names} ›", linking to that
      day's screen with `from=/` **and its date**. No Start on these rows. The whole section is hidden when the list is empty.
   3. **Today's block**, exactly as now, including the stale Continue row and done-today links.
   4. "History ›".
3. **Remove** the "This week" section and the recent-past peek rows. Delete `weekRows` if nothing else uses it, and name the
   test edits.
4. **The day screen's date** comes from the link for any upcoming date, not only this week's. Builder chooses the mechanism
   (e.g. a `date` query param). The link must survive Back chains (req-202 item 7). Without a date, the screen behaves as
   now.
5. **Bottom-align Home's content** when it is shorter than the viewport, so today's block sits near the thumb. On a short
   screen it scrolls as normal. `(unconfirmed)`

## Out of scope
- Change day and setup days: req-205.
- The day screen's contents.
- History.

## Acceptance
1. **Unit `upcomingWorkouts`:**
   - Mon/Thu plan, today Wed → Thu, Mon, Thu.
   - In a 2-week loop with Sat A in week 1 and Sat B in week 2, the right names come for each date.
   - An empty schedule → `[]`.
   - A day with 2 slots → one row with both.
   - Today is excluded.
2. **Browser, seeded, 390×844:**
   - Home text order is Workouts › … Coming up (3 rows, furthest first) … today's date block … History.
   - No "This week" and no Rest rows.
   - Screenshot.
3. **Browser:** tapping the nearest upcoming row, when it falls **next** week, opens "{Weekday}, {date}" with Start now. Back
   returns to Home.
4. **Failure case, 375×667:** today's Start is fully visible without scrolling, with 3 upcoming rows and a stale Continue row.
   Receipt: the bounding box vs the viewport.
5. **Failure case:** with no schedule at all, Home shows no "Coming up" header, and today's block plus History render.
6. `./check` green. **This branch's own** smoke is green on the committed sha (L-049).
