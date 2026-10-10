**Status: BUILT, NOT merged** **Lane: ui**

# req-214 — Home: one-line done, one Start for several, Start on the scheduled-workout screen

DEC-119 §3 (Emilio, H20 "Todays done can be one line: Core Done - See details >", H21 "ask which to start in a modal instead of
each one having a start button", H4 "Be able to start this workout from here"). Builder: throwaway agent. **After req-213.**

## Facts (rescanned 2026-10-10, `main` 25d366a)

- Done today: name line + `<p className="ui-sub"><NavLink …>Done ✓ — see your sets</NavLink></p>` (`views/Today.jsx:110-132`);
  extra same-day finishes as `TodayDone` list (`Today.jsx:158-171`).
- 2+ today: each `TodayRoutine` has its own full-width primary `StartButton` with slot + date + occurrenceId (`Today.jsx:23-40,
  134-150`); an in-progress one first with Continue.
- `/schedule/:week/:weekday/:slotId` → `ScheduleSlot` → `RoutineDetail` (`views/Schedule.jsx:344-374`, `views/Routine.jsx:600-613`),
  no Start. Day screen's "Start now" starts off-schedule (`Schedule.jsx:242`).

## Scope

1. **Done = one `Row`:** "{name}" with value "Done ✓" and a chevron → that session (same link as now). Applies to covered spots
   and `TodayDone` lines.
2. **2+ not-done, not-in-progress spots today:** their per-workout Starts go; the names list as plain lines, and **one primary
   Start** opens a sheet listing them (each a button → that spot's existing start, with its slot/date/occurrenceId). One
   startable spot → the button starts it directly, as now. An in-progress workout keeps its own Continue (unchanged) and the
   others are not startable from Home while it runs (as today's `startOrContinue` rules — no change).
3. **Scheduled-workout screen:** a primary **Start** at the top when the routine is startable. For today's date it starts that
   spot (slot + date + occurrenceId, as Home does); for any other date it starts off-schedule (as the day screen's Start now).
   If a workout is in progress, it reads Continue.

## Out of scope

Coming-up rows (no Start there); the Workouts list Start; any change to start rules.

## Acceptance criteria

1. Browser: one done + one pending today → the done one is a single row "Core … Done ✓ ›"; tapping it opens the session.
2. Browser: two pending → exactly one Start; tapping it shows both names; picking the second starts it with its own slot (stored
   `scheduleSlotId` / `scheduledFor` receipt).
3. **Failure case:** dismissing the sheet starts nothing (no `activeWorkout`).
4. Scheduled-workout screen for tomorrow → Start makes an off-schedule workout (no `scheduledFor`); for today → tagged with today.
5. Empty workout (no exercises) → no Start on that screen.
6. `./check` green.

## Decisions made on Emilio's behalf

- **behaviour** `(unconfirmed)`: future-date Start from the slot screen is off-schedule (not pre-logged for that future date).
- **behaviour** `(unconfirmed)`: done row value text "Done ✓".
- **implementation:** the sheet may reuse the picker/sheet component req-212 adds if it fits.

## READY checks

1. DECs: DEC-108 §5, DEC-110 §4, DEC-113–115, req-110 (two-routine day). 2. req-213 touches Today.jsx (build before). 3–5 none.
6. marked.
