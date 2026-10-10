**Status: BUILT, NOT merged** **Lane: ui** — writes the schedule only through the existing `addSlot` / `removeSlot` store actions (one user tap
each), no bulk write.

# req-215 — New workout without days; "Days" on the workout's screen; "Use a plan" only when you have none

DEC-119 §4 (Emilio, H13 "Use a plan here? What if i already have one?", H14 "add workout should not handle days … As its also
setting up a Schedule?", H17 "I should be able to set it on a day from here"). Supersedes DEC-116's days step and DEC-117 §6.
Builder: throwaway agent. Independent of req-212..214.

## Facts (rescanned 2026-10-10, `main` 25d366a)

- `/routines/new` (`views/Routine.jsx:117-138`): "Pick your exercises" (primary) → `/routines/new/machines`, "Not sure? Use a plan"
  → `/routines/new/plan`, "Blank workout".
- Machines flow (`views/Plan.jsx:288-448`): picker "Next (N)" → days count → weekday chips (only on an empty schedule,
  `Plan.jsx:319-336`) → same/A-B → preview → name(s) last ("New workout #N", DEC-116) → `applyPlan`.
- With slots already present the plan leaves the schedule alone (`plan-templates.js:292-301`, `Plan.jsx:165-182, 326, 375`).
- Workout screen `RoutineDetail` (`Routine.jsx:159-260`): Edit name, Add exercise, Reorder, rows, Delete; no scheduling.
- Store: `addSlot({ week, weekday, routineId })`, `removeSlot(slotId)` (`store.jsx:107, 132`); loop weeks `clampLoopWeeks`;
  `routineScheduledDaysText` (`state-reducers.js:43`) already names a routine's days ("Mon and Thu").

## Scope

1. **New workout** (machines flow when the user has ≥1 active workout): picker → **name** (prefilled "New workout #N") → Save →
   the new workout's screen. No days count, chips, A/B or preview. One workout made.
2. **First time** (no active workouts): `/routines/new` and the machines flow stay as they are today (days, chips, A/B), and
   "Not sure? Use a plan" shows. With ≥1 active workout, "Use a plan" is not shown.
3. **"Days" row on the workout's screen** (above Exercises): value = `routineScheduledDaysText` or "Not scheduled". Tap → weekday
   chips Mon–Sun, preselected where this workout has a slot. Turning a day on adds a slot for it **in every loop week** that lacks
   one; turning it off removes this workout's slots on that weekday in every loop week. Each tap writes immediately. The same row
   shows on the scheduled-workout screen (`ScheduleSlot` renders `RoutineDetail`).
4. Plans and their Done screen are unchanged apart from (2).

## Out of scope

Plan templates' content; the day screen's Add workout (stays); one-date moves (DEC-117 §2, unchanged); a multi-week editor in the
Days row.

## Acceptance criteria

1. Browser, ≥1 workout: New workout → pick 2 → name → Save; no days step appears; schedule `slots` count unchanged (receipt).
2. Browser, fresh store: the first-time flow still shows days + chips and still schedules (unchanged path).
3. `/routines/new` with ≥1 workout has no "Use a plan"; with none it has.
4. Days row: turn on Wed in a 2-week loop → 2 new slots, both this routine, weekday 3; turn off → both gone, other routines'
   Wed slots untouched (unit on the helper + browser).
5. **Failure case — mixed weeks:** this routine on Mon in week 1 only → Mon shows on; turning it off removes that one slot; turning
   it on again adds Mon to both weeks.
6. **Archived / empty:** the Days row is hidden on an archived workout; an empty workout can still be scheduled.
7. `./check` green.

## Decisions made on Emilio's behalf

- **behaviour** `(unconfirmed)`: the first-time flow keeps its days step (it builds a whole plan); only later workouts skip it.
- **behaviour** `(unconfirmed)`: a Days chip applies to every loop week; a day on in any week reads as on.
- **behaviour** `(unconfirmed)`: after Save the user lands on the new workout's screen (where Days is).

## READY checks

1. DECs: DEC-105, DEC-110 §5, DEC-116, DEC-117 §2/§6. 2. Siblings: req-214 adds Start to the scheduled-workout screen (same
   `RoutineDetail`) — order-free, different region; rebase whichever lands second. 3. none. 4. none. 5. no trigger files (store
   actions reused). 6. marked.
