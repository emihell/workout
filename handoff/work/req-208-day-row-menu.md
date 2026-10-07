# req-208 — day screen: Change day and Remove behind "⋯"; the row shows the name and Start now

**Status: READY** (2026-10-07). **Lane: ui.** Emilio said "ok" to Planner's recommendation after seeing `r207-day.png`.
There, at 390 px, "Start now / Change day / Remove" wrapped each label onto 2 lines.

## Code today (main, after req-207)
- `views/Schedule.jsx` `ScheduleDay`: each slot row shows its name, then Start now (when `startNowShown`), Change day and
  Remove, wrapping below the name (`ui.css`, req-207 `ffeeabe`).
- The in-workout list already has a "⋯" row menu (Swap / Skip / Cancel; req-188). Reuse that pattern or component.

## Scope
1. Each slot row: the workout name, plus **Start now** (when shown) on the same line, plus a **"⋯"** button.
2. "⋯" opens the same menu or sheet pattern as the in-workout row menu, with **Change day** and **Remove**. Their behaviour
   and confirm copy are unchanged.
3. No label wraps at 375 px.

## Acceptance
1. Browser at 375×667: a day with one workout shows the name, Start now and ⋯ on one line. No button text wraps: each
   button's height equals one line height.
2. ⋯ → Change day → Saturday moves the slot (receipt: v9 `schedule.slots`). ⋯ → Remove → the confirm still reads "Take X off
   {Day}s? Your history is kept."
3. **Failure case:** a past date (no Start now) shows the name and ⋯ only. ⋯ still works.
4. Screenshot to `/private/tmp/claude-501/-Users-emiliohellberg-projects-workout-workout-planning/a2f9aeb8-ef44-4bb9-9b4b-171a32f002ca/scratchpad/r208-day.png`.
5. `./check` green. **This branch's own** smoke is green on the committed sha (L-049).
