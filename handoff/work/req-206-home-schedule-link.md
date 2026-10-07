# req-206 — Home: "Schedule ›" uses the same link as "Workouts ›"; no "Coming up" header; first-run says Schedule

**Status: READY** (2026-10-07). **Lane: ui.** Emilio, after req-205: "can the bttom schedule be similar as workout? same
component? why use another component? … can we remove coming up title? i think one gets it". Also the req-205 follow-up:
first-run Home still shows History instead of Schedule (DEC-115).

## Code today (main, after req-205)
- `views/Today.jsx:364`: `<NavLink to="/routines" chevron="forward">Workouts</NavLink>` at the top.
- `:399`: `<Row to="/schedule">Schedule</Row>` at the bottom, a full-width list row in a `List`.
- `:368`: `<SectionHeader>Coming up</SectionHeader>`.
- First-run Home (`:336-338` area): rows "Workouts" plus "History" `[inferred: req-205 report]`.

## Scope
1. The bottom "Schedule ›" renders with **the same component and styling as "Workouts ›"**: a `NavLink` with
   `chevron="forward"`, not a `Row` in a `List`.
2. Remove the "Coming up" `SectionHeader`. The 6 day rows follow "Workouts ›" directly.
3. First-run Home: its "History" row becomes "Schedule" → `/schedule`, the same as the main Home. If its links there are
   `Row`s alongside "Workouts", they stay consistent with each other.

## Out of scope
- Anything else on Home.
- Change day and setup days (req-207).

## Acceptance
1. Browser at 390×844, seeded: "Workouts ›" and "Schedule ›" have the same tag, class list and font size (receipt: computed
   styles). There is no "Coming up" text. Save a screenshot to
   `/private/tmp/claude-501/-Users-emiliohellberg-projects-workout-workout-planning/a2f9aeb8-ef44-4bb9-9b4b-171a32f002ca/scratchpad/r206-home.png`.
2. **Failure case:** the gap between sections is still ≤ 32 px, and today's Start is still fully visible at 390×844 at
   scrollY 0.
3. First-run Home (empty origin) shows "Schedule", not "History".
4. `./check` green. **This branch's own** smoke is green on the committed sha (L-049).

## Built — calls
- **Emilio saw the screenshot and said "ok"** (L-050).
- First-run's Schedule stays a `Row`, matching its Workouts row.
- The gap from "Workouts ›" to the rows is 16 px. The spare space above is 147 px at 390×844.
