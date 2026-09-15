# req-76 — Continue resumes into the current exercise (N2, gym-flow batch 2)

**Status: BUILT AND MERGED, 2026-09-16 — branch `req-76` (`b3337a6`…`b3337a6`, 1 commit).** From Emilio's 2026-09-14 notes:
*"If I start an exercise in a workout, go elsewhere, then press continue on the active
workout — I should go straight into the exercise."*

**Gate: gym-flow feel (ux-feel).**

## Why

[measured] `startOrContinue` resumes onto the Workout **overview** (`/workout/:routineId`,
`views/workout/overview.jsx` lists the exercises) — the user then has to find and tap the
in-progress exercise. The current item is already computable: `overview.jsx:105,136` derive
`completed` per item and `itemCurrentPath(routineId, item, completed)`.

## The behaviour

On Continue/resume of an in-progress workout, route **directly to the first not-done
exercise's log page** (`itemCurrentPath` of the first item whose `completed` is false),
skipping the overview. If every exercise is done, land on the overview with **Finish**
visible (do not open a broken/empty exercise page).

## Scope

- Resume routing only — the Continue/`startOrContinue` landing path.

## Out of scope

- The overview list itself (unchanged; still reachable).
- Start-new behaviour, any data change.

## Acceptance criteria

- **Resume lands on current (browser):** mid-workout, leave the Workout screen, tap Continue →
  land on the first not-done exercise's log page, not the overview.
- **Failure/edge:** every exercise done → Continue lands on the overview with Finish visible,
  not a broken or empty exercise page.
- **No regression:** `./check` green.

## Decisions

- "current" = first not-done item (completed and skipped both count as not-current).
- Implementation (CC): exact route via the existing `itemCurrentPath`.
