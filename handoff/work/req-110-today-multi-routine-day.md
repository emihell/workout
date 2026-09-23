# req-110 — Today: a day with two routines reads as one day with two routines (batch 4, F10)

**Status: SPEC — READY, held for Emilio's go.** Phase 1. **[ux-feel]**

From Emilio's in-app note (2026-09-20, `/`): *"Need to show 2x Rutines or similar of a day has more than
one rutine on it"*. Clarified 2026-09-23: it's **today's block**, and the routines should be **grouped
under one date**.

## Why

[measured] `Today.jsx:310` maps each of today's slots to its own `TodayWorkout` block
(`Today.jsx:118`). Each block repeats the date line and has its own full-width primary Start, so a
two-routine day looks like the same day printed twice.

## The behaviour

- **One routine today:** unchanged.
- **Two or more:** **one** date line, then each routine under it: its name — focus, and its own Start
  (or `Done …` once finished), in schedule order. It reads as one day with N routines.
- The in-progress hero (`TodayHero`, DEC-038) still replaces the whole today block while a workout
  started today is active, as now — so while routine 1 is in progress, routine 2's Start is hidden until
  routine 1 is finished or abandoned. Unchanged, by design.

## Scope

`src/views/Today.jsx`; `src/ui/ui.css`.

## Out of scope

The upcoming peek and the Schedule page (not the reported surface); the empty day; the one-active-workout
rule (DEC-038).

## Acceptance criteria

- **Grouped (browser):** schedule two routines today → a single date line with both routines and a
  Start for each.
- **Each Start starts its own routine:** tapping the second routine's Start opens that routine's
  workout, with the right slot (`scheduleSlotId`).
- **Failure case — one done:** finish one → it shows `Done …` and the other still has Start, under the
  same date.
- **One routine:** a single-routine day renders as before.
- **No regression:** `./check` green.

## Decisions

- Today's block, grouped under one date (Emilio, 2026-09-23).
- Whether the Starts stay full-width primary when there are two — implementation (CC), within one
  clearly-tappable Start per routine.
