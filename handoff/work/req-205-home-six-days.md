# req-205 — Home: 6 days forward with rest days, no title, no gap between sections

**Status: READY** (2026-10-07). **Lane: ui.** From DEC-114 (amends DEC-113 / req-204). **Emilio sees a screenshot before
merge (L-050).** **+ DEC-115, added mid-build:** Home's last row is "Schedule ›"; Schedule ends with "History ›";
History's Back → /schedule; the Workouts list drops "Whole plan ›".

## Code today (main, after req-204)
- **`views/Today.jsx`:** title "Today" → "Workouts ›" → bottom-aligned group (Coming up via `upcomingWorkouts(schedule,
  routines, today, 3)` in `schedule.js`, then today's block, then History ›). The gap sits between "Workouts ›" and "Coming
  up" (Planner viewed `r204-home.png`).
- **Coming-up rows** link `/schedule/W/D?date=YYYY-MM-DD&from=%2F` (req-204 `dayScreenDate`).

## Scope
1. **Coming up = the next 6 calendar dates after today**, furthest first. Each row is "{Wkd}, {Mon d} · {names}" or "{Wkd},
   {Mon d} · Rest", with Rest muted.
   - Every row links to its dated day screen, as now.
   - No Start on any row.
   - Replace or extend `upcomingWorkouts` with a pure helper returning 6 dated rows with `slots` (possibly empty), loop-aware.
2. **Remove the visible "Today" title.** Keep a visually hidden `h1` for screen readers.
3. **No gap between sections.** The whole Home column ("Workouts ›" through "History ›") is one block, bottom-aligned on a
   tall screen. Spare space goes above "Workouts ›" only. On a short screen it scrolls normally, with no min-height overflow.

## Out of scope
- Today's block contents.
- The day screen.
- Change day and setup days (req-206).

## Acceptance
1. Unit: with a Mon/Thu plan and today Wed, the helper gives Thu, Fri(Rest), Sat(Rest), Sun(Rest), Mon, Tue(Rest) in date
   order. Home renders them reversed. A 2-week loop gives the right names per date.
2. Browser at 390×844, seeded: there is no visible "Today" heading. The order is Workouts › → 6 rows (furthest first) →
   today's block → History. **The vertical gap between any two adjacent sections is ≤ 32 px.** Receipt: the bounding boxes.
   Save a screenshot to `/private/tmp/claude-501/-Users-emiliohellberg-projects-workout-workout-planning/a2f9aeb8-ef44-4bb9-9b4b-171a32f002ca/scratchpad/r205-home.png`.
3. **Failure case at 375×667** with a stale Continue row: today's Start is fully visible after scrolling to the bottom, the page
   has no horizontal scroll, and nothing overlaps. Report whether Start is visible at scrollY 0.
4. Browser: a Rest row opens its dated day screen showing "None." and "Add workout ›".
5. `./check` green. **This branch's own** smoke is green on the committed sha (L-049).

## Built — calls
- **Emilio saw the screenshot and said "ok"** (L-050 gate).
- The "Coming up" header is kept.
- **No schedule:** 6 grey Rest rows; req-204 hid the section.
- **A 2-week loop** keeps a "Week x of y" line above "Workouts ›". At 375×667 Start is then 16 px below the fold.
- A day whose only workouts are archived reads "Rest".
- **Follow-up:** first-run Home still has a visible "Today" title and a "History" row. It should become "Schedule" (DEC-115),
  in req-206.
