# req-28 — show completed workouts on the Today page (note #7)

**Status: READY** (behaviour decided below; ux-feel gate confirms). From Emilio's 2026-09-10 notes:
*"To see completed routines on the main page."*

**Gate: gym-flow feel** (DEC-009) — **Emilio uses it before merge.**

## Why

The Today page lists what's scheduled and lets you Start/Resume. [measured] a scheduled slot already
flips to a `Done {date}` label once a covering workout exists (`WorkoutRow`, `src/views/Today.jsx:29–38`),
but there is no view of what you've **completed** — a finished workout that wasn't a scheduled slot,
or just confirmation of today's done sessions, isn't surfaced on the main page.

## The behaviour (decided)

Add a **"Completed today"** section to the Today page listing the workouts finished **today**
(`finishedAt` on today's date), each a row linking to its history detail
(`/history/<workoutId>`). Show it only when there is at least one; keep it below the scheduled/Start
area so the primary action stays first.

**Decided:** today's completed only (not a general recent-history glance — that's what History is for).
If Emilio wants "recent" (last few days) instead, the feel-gate catches it. [measured] the data is
`store.workouts` filtered by `finishedAt` — the same source History uses.

## Scope

- A "Completed today" list section on `Today.jsx`, rows linking to each finished workout's history
  detail, shown only when non-empty.

## Out of scope

- Changing the scheduled-slot rows or their `Done {date}` label (already there).
- A recent/multi-day view (that's History).
- Any new stored field — read `finishedAt` off existing workouts.

## Acceptance criteria

- **Completed shows (Emilio, in-browser):** finish a workout today → it appears in a "Completed today"
  section on Today, linking to its history detail; tapping the row opens that workout in History.
- **Empty state:** with nothing finished today, no empty "Completed today" section renders.
- **Right day:** a workout finished on a previous day does **not** appear (it's in History, not Today).
- **No regression:** `./check` green; the scheduled/Start rows are unchanged.

## Decisions

- **behaviour:** decided above (today's completed, linking to History). "Recent instead of today" is
  the feel-gate's to redirect.
- **implementation (CC's call):** exact section placement/label; the today-date comparison (reuse the
  helper History/schedule already uses).
