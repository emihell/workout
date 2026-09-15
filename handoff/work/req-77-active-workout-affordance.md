# req-77 — active-workout affordance across the app (N4, gym-flow batch 2)

**Status: PAUSED (Emilio, 2026-09-16) — do not schedule or re-raise the badge/floating pick
until Emilio revives it.** Was NEEDS DECISION (one pick), saved 2026-09-14. From Emilio's
2026-09-14 notes: *"There should maybe be a floating button for active workout? Or a signal
in the workout button in menu?"*

**Gate: gym-flow feel (ux-feel).**

## Why

With a workout in progress, leaving the Workout screen loses the thread; returning means
navigating to Today and finding Continue. A persistent signal keeps the active workout one tap
away from anywhere. Pairs with **req-76** (Continue lands on the current exercise).

## Open decision (Emilio)

The affordance shape:
- **(a) a badge/dot on the Workout (or nav) tab** while a workout is active — *recommended*: a
  floating button competes with the log UI and the bottom nav.
- **(b) a floating "Continue" button** overlaid on other screens.

## The behaviour (pending the pick)

While `store.activeWorkout` exists, show a persistent signal; activating it resumes via
`startOrContinue` (into the current exercise, per req-76). No active workout → no signal.

## Scope

- The signal element + its resume action. No change to the workout itself.

## Out of scope

- Any data change; the Today hero/Continue rows (they stay).

## Acceptance criteria

- **Signal shows (browser):** with an active workout, the signal is visible from other screens;
  activating it resumes into the workout.
- **Absent when idle:** no active workout → no signal renders.
- **No regression:** `./check` green.

## Decisions

- Badge vs floating (Emilio) — blocks READY.
