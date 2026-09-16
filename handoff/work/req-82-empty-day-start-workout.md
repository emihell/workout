# req-82 — empty-day Start = start a workout (N1, gym-flow batch 2)

**Status: READY — Emilio picked (a) routine picker, 2026-09-16. No model change.**
From Emilio's 2026-09-14 notes: *"If nothing is scheduled today, make the start button 'start new workout'."*

**Gate: functional.**

## Why

[measured] when nothing is scheduled, `TodayEmpty` renders **Start disabled**
(`views/Today.jsx:191`) — there is nothing to start. `startOrContinue` requires a `routineId`
(`workout-actions.js:14`); there is no ad-hoc / blank-workout path.

## The behaviour (decided: (a) routine picker, Emilio 2026-09-16)

When nothing is scheduled today, the empty-day Start becomes an **enabled** "Start new workout" that
opens a **routine picker** — a list of the user's existing routines; picking one starts it now,
off-schedule, via the existing `startOrContinue(store, routineId)`. No blank/ad-hoc workout, no new
data shape (option (b) is **not** built — reversible later if ad-hoc sessions are wanted).

## Scope

- The `TodayEmpty` state (`views/Today.jsx:186`): replace the disabled Start with an enabled control
  that leads to the routine picker, and wire the pick to `startOrContinue`.
- Reuse whatever routine-list UI already exists (Today's empty-data fallback lists routines at
  `Today.jsx:253` — CC picks the cleanest existing surface rather than inventing one).

## Out of scope

- Blank/ad-hoc (routine-less) workouts (option (b)).
- A scheduled day (the today hero / Start blocks stay exactly as they are).
- Any data/schema change.

## Acceptance criteria

- **Enabled + starts (browser):** on a day with nothing scheduled, Start is enabled → opens the
  routine picker → picking a routine starts that workout (lands per req-76 resume behaviour).
- **No routines (failure case):** with zero routines defined, the empty-day Start leads somewhere
  sensible (the create-a-routine path), not a dead/empty picker or a crash.
- **Scheduled day unchanged:** a day with a scheduled routine behaves exactly as before.
- **No regression:** `./check` green.

## Decisions

- (a) routine picker chosen over (b) ad-hoc (Emilio, 2026-09-16). No persisted-data change.
- Which existing routine-list surface to reuse — implementation (CC).
