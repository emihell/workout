# req-53 — In-progress workout becomes the main-page hero (drop the "in progress" row)

**Status: BUILT AND MERGED, 2026-09-13 — branch `req-53` (`f08a023`…`f08a023`, 1 commit).** From Emilio 2026-09-13: *"If workout is in progress - remove the
'in progress row' instead - the today start button should be the continue button and
it should say in progress next to the routine info."* Open case (active workout that
isn't today's slot) decided by Emilio 2026-09-13: **the in-progress workout is always
the hero.**

**Gate: ux-feel** — planning builds + tests + merges on its own testing (DEC-035);
Emilio's on-device look is the non-blocking after-check. Single view (`Today.jsx`
owns its own behaviour) — no shared-code blast radius, no reviewer subagent needed.

## Why

The Workout tab has two in-progress affordances today:
1. A top row **"In progress. [Continue]"** shown whenever any workout is active
   (`Today.jsx:205-210`, `mine = store.activeWorkout`).
2. The emphasized **today block** (`TodayWorkout`, `:107-128`) shows the big primary
   **Start** — but when the active workout is *exactly today's slot*
   (`inProgress`, `:110-113`: routine + `scheduleSlotId` + `scheduledFor === today`
   all match) it renders **nothing** in the button slot (`:123` `inProgress ? null`),
   deferring to the top row.

Emilio wants the in-progress state folded into the emphasized block: no separate row,
the big button becomes **Continue**, and an **"in progress"** marker sits next to the
routine info.

## The behaviour (decided)

**The active workout (`store.activeWorkout`) is always the emphasized hero block when
one exists** — whatever it is:

- **Remove** the top "In progress. [Continue]" row (`:205-210`).
- The hero for the active workout shows its **routine name (+ focus)**, an **"in
  progress"** indicator **next to the routine info**, and a large primary **Continue**
  button that resumes it (`startOrContinue(store, activeRoutineId(mine))` — the same
  call the old row used, `:208`).
- **When the active workout matches a today slot** (the existing `inProgress` case):
  that slot's `TodayWorkout` *is* the hero — its button slot shows **Continue** + the
  "in progress" marker instead of `null` (`:123`). It renders **once** (no duplicate
  row, no separate hero).
- **When the active workout is NOT a today slot** (started ahead from Upcoming, ad-hoc
  from `/start`, or nothing scheduled today): render a **standalone in-progress hero**
  for it, above today's scheduled block(s). Today's scheduled workouts still render
  below as normal **Start** rows. If nothing is scheduled today, show the in-progress
  hero and **suppress `TodayEmpty`** (don't show "Nothing scheduled" while a workout is
  in progress).
- **No active workout:** unchanged — the today block shows **Start** (or `TodayEmpty`);
  the (now-removed) top row is simply absent.

Name/focus for the active workout come from its own record the way the history peek
rows resolve them (`findRoutine` + `workoutRoutineName` + `workout.snapshot?.focus`,
see `Today.jsx:54-72`) — never invent a name; if the routine was archived/deleted the
snapshot name still shows (DESIGN §1).

## Scope

- `Today.jsx`: remove the top in-progress row; make `TodayWorkout` render Continue +
  "in progress" in the `inProgress` case; add the standalone in-progress hero for the
  not-today case; suppress `TodayEmpty` when a standalone hero shows; avoid rendering
  the active workout twice.
- `ui.css`: a small "in progress" marker style if needed (grayscale, existing tokens).
- Any `Today` test that asserted the old top row is updated to the new hero (justified
  in the diff — not weakened).

## Out of scope

- `startOrContinue` and its "Save draft?" confirm when starting a different routine
  while one is active (`workout-actions.js:9-11`) — unchanged.
- The `ui-screen--subbar` / Routines-strip hide-when-active logic (`:197`, `:252`) —
  keep as is.
- The in-workout flow screens.
- No data/model/store change.

## Ordered steps

1. Remove the top "In progress" row (`:205-210`).
2. `TodayWorkout`: in the `inProgress` branch, render a primary **Continue** (resumes
   via `startOrContinue(store, activeRoutineId(mine))`) and an "in progress" marker by
   the name.
3. Add the standalone in-progress hero for an active workout that matches no today
   slot; place it above the today block(s); suppress `TodayEmpty` in that case.
4. Ensure the active workout shows exactly once (matched-slot case uses the slot's
   block; unmatched case uses the standalone hero).
5. `ui.css` marker if needed; `./check`.

## Acceptance criteria (written before implementation)

- **Today's workout in progress:** start today's scheduled workout, return to Workout →
  the today block shows the routine, an "in progress" marker by the info, and a primary
  **Continue** that resumes it; the old "In progress." row is gone; the workout is not
  shown twice.
- **In-progress that isn't today's slot (the decided case):** start a workout ahead
  from Upcoming (or ad-hoc from `/start`, or with nothing scheduled today) → a
  standalone in-progress hero shows with Continue + "in progress"; today's scheduled
  block still shows below as Start (or no "Nothing scheduled" when today is empty).
- **No active workout (failure/negative case):** with nothing in progress, no Continue
  and no "in progress" marker render anywhere, and the today block shows **Start** — a
  grep/assert that the "in progress" marker and the removed row do not appear.
- **Deleted/archived routine (failure case):** an active workout whose routine was
  archived/deleted still renders the hero (name from the snapshot, no crash) and
  Continue still resumes it.
- **No regression:** `./check` green — paste the line; any updated `Today` test output
  pasted.

## Decisions

- **behaviour (Emilio):** in-progress is always the emphasized hero; big button →
  Continue; "in progress" next to the routine info; top row removed.
- **implementation (CC's call):** exact "in progress" placement (inline chip vs
  sub-line) and marker style; whether the standalone hero reuses/generalises
  `TodayWorkout` or is its own small component; the date line shown on the standalone
  hero (use the active workout's own date; do not invent one).
