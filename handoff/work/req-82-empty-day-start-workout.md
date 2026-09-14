# req-82 — empty-day Start = start a workout (N1, gym-flow batch 2)

**Status: NEEDS DECISION — saved 2026-09-14, not scheduled.** From Emilio's 2026-09-14 notes:
*"If nothing is scheduled today, make the start button 'start new workout'."*

**Gate: functional** (persisted-data if the ad-hoc-workout direction is chosen).

## Why

[measured] when nothing is scheduled, `TodayEmpty` renders **Start disabled**
(`views/Today.jsx:191`) — there is nothing to start. `startOrContinue` requires a `routineId`
(`workout-actions.js:14`); there is no ad-hoc / blank-workout path.

## Open decision (Emilio)

What does "Start new workout" do?
- **(a) open a routine picker** — start any existing routine now, off-schedule. *Recommended
  first step:* no model change, reuses `startOrContinue`.
- **(b) start a blank ad-hoc workout** — no routine; exercises added on the fly. A larger,
  **persisted-data** feature (new workout shape without a routine; ask-gate + migration test).

## Scope / acceptance

Written once the direction is picked. Provisional acceptance:
- Empty-day Start is **enabled** and starts a workout (per the chosen direction).
- A scheduled day is unchanged (the today hero / Start blocks behave as before).
- `./check` green.

## Decisions

- Direction (a) vs (b) (Emilio) — blocks READY. (b) additionally triggers the persisted-data
  ask-gate.
