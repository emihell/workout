# req-195 — a workout done today shows in today's block, not as a second "today" row

**Status: BUILT, NOT merged** (2026-10-06). **Lane: ui.** From DEC-108 §5 (G15: "I completed a workout today but can't see it in the
list?" → "i see it under todays date - its like there are two rows for todays date - i think completed workouts, for same
day, should be in the same row"). Independent of 192–194 (`views/Today.jsx` only). No trigger files expected.

## Code today (main `4da90e1`)
- Today's block: `TodayHero` (in-progress) / `TodayWorkouts` (scheduled today) / `TodayEmpty` ("Tue, Oct 6 · Nothing scheduled
  today. · Start new workout") (`views/Today.jsx:252-263`, `:385-391`).
- Below it, one `List`: `completedToday` rows (`CompletedTodayRow`, today's date) then the recent peek (`:404-418`) — so an
  unscheduled workout finished today reads as a second "today" entry under "Nothing scheduled today."
- `completedOnDayKey` (`history-queries.js:14-18`) by local `finishedAt` day.

## Scope
1. Workouts finished today render **inside today's block** under the date: "Lower body · Done ✓" (tap → its History detail,
   `withFrom('/')` as today) `(unconfirmed)`. "Nothing scheduled today." is not shown when something was done today; "Start
   new workout" stays (secondary once something is done `(unconfirmed)`).
2. A scheduled-and-done slot today shows once (its slot row "Done"), not also as a separate completed row.
3. The list below holds prior days only (recent peek + History).

## Acceptance
1. Browser (fixed clock): finish an unscheduled workout today → today's block shows "… · Done", no "Nothing scheduled
   today."; the list below has no row dated today (receipt: DOM text).
2. Scheduled today + done → one row for it in today's block.
3. **Failure case:** nothing done today → today's block exactly as before (snapshot of the DOM text).
4. Two workouts done today → both in today's block.
5. `./check` green; smoke green.

## Decisions made on Emilio's behalf `(unconfirmed)`
Row wording; Start new workout styling after a done workout.

## Built — calls `(unconfirmed)`
Row "Lower Body · Done ✓ ›" (chevron per DESIGN §4); Start new workout secondary once something is done; done rows after the
day's slots, oldest first; done rows also inside the in-progress hero block.
