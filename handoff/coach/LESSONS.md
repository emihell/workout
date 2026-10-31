# Coach — lessons from runs (general only)

How the data and the app behave, learned from runs. **No client facts here** (DEC-147): a lesson about one person goes to
their `CLIENT.md`. Planner owns this file; Coach proposes lessons under "For Planner".

## Reading the data

- Snapshot items have no `id` — sets join on `routineItemId` (run 1).
- Older workouts may keep AMRAP reps and real kg in set `note`s ("did 15 kg") (run 1).
- `startedAt` / `finishedAt` are nonsense on a workout left open, and `loggedAt` can span days: use only plausible
  session times (run 1).
- **Real minutes = sets sorted by `loggedAt`**, not the plan's estimate (run 4).
- A skipped `setType: "wu"` is a warm-up, not a working set; don't count it against the plan (run 4).
- `weightStep: "n/a"` → say "next bell / next plate" and leave the number to the client (run 1).
- Kettlebells step by the bells the client has logged, not a stored `weightStep` (run 1, run 3).
- Logged machine weights that don't exist on the machine: the notes hold the real nearest step (run 2).
- Routines can be an unrun draft: history is the truth; a routine's kg is a proposal to check against it (runs 1–2).

## Method

- **Calibration:** an exercise's first 2 sessions ever, and the first session back after > 8 weeks off. Never progress
  or a stall (run 2).
- **Session length rule** (keeps runs comparable): 40 s per set + the rest as written + 1 min per station change (run 1).
- **Count arms inside "upper"** for the upper : lower balance (run 3).
- **Unchanged data → corrections only** (run 2).
- **What's last gets dropped:** never place a session's only hinge/hamstring (or any priority) exercise last (run 4).
- **Retired = archived** only when nothing points at it; a routine kept as a swap-in stays live, unscheduled (run 3).
- The coach leaves existing exercise settings alone unless the plan says so; a settings fix is listed in the report (run 3).
- Intake should ask bodyweight + waist (+ target), the equipment that exists, and why training gaps happen (run 1).
