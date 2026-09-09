# req-03 — persistent workout-level rest timer

Branch: `req-03-persistent-rest-timer`. Implements DEC-003 (persistent rest bar on all
in-workout screens; keep Pause/Resume/Skip/+30s; no auto-start between exercises).

## Technical

### Root cause (confirmed)
The rest state was already workout-level and persisted (`activeWorkout.restEndsAt` /
`activeWorkout.restPausedRemaining`), but the display — the `RestBox` and the 250 ms tick
`setInterval` — lived only inside `WorkoutItemLive` (the single set-logging screen). Leaving that
screen unmounted the only thing drawing the countdown, so the timer "vanished" though rest kept
running underneath.

### What changed (all in `src/views/Workout.jsx`)
- **New `useRestCountdown(active)` hook** — encapsulates the tick (`setInterval` at 250 ms, only
  while a rest is active/paused) and the remaining/`paused`/`resting` computation, so that logic
  lives in one place. Reads only `activeWorkout.restEndsAt` / `restPausedRemaining`. Byte-for-byte
  the same computation the old inline code used.
- **`RestBox` → `RestBar`** — the single, self-contained rest UI. It reads `store.activeWorkout`,
  uses the hook, and **returns `null` when there is no active workout or no rest**, so it can be
  dropped into any screen and shows only during a rest. It carries the existing controls unchanged
  (Pause/Resume/Skip/+30s, same `patchActive` handlers). Wrapped in a `<div role="status">`.
- **`WorkoutItemLive`** — dropped its own tick/`now`/`remainingMs`/inline `RestBox`; now takes
  `resting` from the shared hook (still used to gate the set form and to auto-advance to review
  when rest ends). During rest it renders just the "Previous" button; the countdown comes from the
  persistent `RestBar` at the top of the screen.
- **`<RestBar />` added to every in-workout screen**: workout overview (`Workout`, active branch),
  item log (`WorkoutItemLive`), item review (`WorkoutItemDone`), finish (`FinishScreen`), plus the
  two other screens reachable mid-rest — exercise edit (`WorkoutItemExercise`) and set edit
  (`WorkoutSetEdit`). Placed just after `<Back />` on each. Not added to pre-start screens
  (`WorkoutSetup`/preview) or to non-workout screens (Today/History/Settings) — out of scope.

### Choices the spec left open (step 1: "CC to choose the seam")
- **Per-screen placement over a route wrapper.** The workout screens share no layout wrapper, and
  a global/`App.jsx` placement would show the bar on Today/History/Settings when a rest runs and
  the user taps the nav — explicitly out of scope. Rendering the self-hiding `<RestBar/>` inside
  each in-workout screen keeps it in-workout only without restructuring routing.
- **Included `WorkoutItemExercise` and `WorkoutSetEdit`** beyond the four screens the spec names,
  because both are reachable while a rest is running and omitting them would reproduce the exact
  "counter disappeared" bug on those paths. Both self-gate on the active workout already.
- **Two live intervals on the set screen** (one in `WorkoutItemLive` for flow, one in `RestBar`
  for display), because `WorkoutItemLive` still needs `resting` to reveal the next set's form when
  the timer expires. Both are 250 ms and only run while resting; the shared hook means no logic
  drift. Could be collapsed to one later if it ever matters.

### Acceptance criteria — status
- **One rest UI (right mechanism):** `grep -rn RestBox src/` → none; one `RestBar` component. Met,
  provable from the diff.
- **`./check` green:** pasted below.
- **Persists across navigation / controls work from anywhere / correct remaining time on
  return / end condition unchanged:** these are the human "use it" gates the spec calls for
  (interval + navigation behaviour in the running app) — see the checklist below. The correctness
  argument: every screen mounts a fresh `RestBar` that recomputes remaining from the persisted
  `restEndsAt` and a freshly-ticking `now`, so navigation/reload can't freeze or reset it; the
  controls write the same persisted fields as before.

### Verification (receipts)
`grep -rn 'RestBox' src/` → (no output). `./check`:
```
check: running 10 test file(s) (node --test)…
# tests 59
# suites 19
# pass 59
# fail 0
check: building (vite build)…
check: green — lint, 10 test file(s), and the build all passed.
```
Pre-existing oxlint warning (`src/views/Routine.jsx:13`) is unrelated and untouched. No unit test
added: the behaviour is interval- and navigation-driven (the repo's tests are logic-level), and
the req frames verification as human use-it gates plus the structural "one component" check, which
the diff satisfies.

### What I could not verify myself (needs the running app)
1. Start a between-sets rest, navigate to overview / next exercise / item review / finish — the
   counter is visible and counting down on each.
2. Pause on one screen, navigate to another → shows Paused with the same remaining time; Resume
   continues; +30s and Skip work from any screen.
3. Navigate away mid-rest and back → shows the correct recomputed remaining time (not frozen/reset);
   same after a reload.
4. When the timer hits 0 or Skip is pressed, the bar clears and the set flow proceeds as before
   (next set's form appears; last set advances to review).

## Workflow
- No scope dropped. Scope **added**: `RestBar` on `WorkoutItemExercise` and `WorkoutSetEdit` (the
  two extra mid-rest-reachable screens), so "the counter never disappears within the workout" holds
  on every reachable in-workout screen, not just the four named. Flagging in case you'd rather the
  bar be limited to the four enumerated screens.
- Left the two pre-existing "related gaps" the spec noted as out of scope untouched (no rest after
  an exercise's final set; `restSec === 0` starts none) — DEC-003 declined auto-start.
- No mid-build decisions needed from Emilio.
