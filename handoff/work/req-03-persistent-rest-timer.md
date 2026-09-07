# req-03 — persistent workout-level rest timer (fixes the disappearing counter)

**Status: READY** — decided (DEC-003). Independent of `req-01`/`req-02` (touches the rest UI / workout shell, not the save or seed paths).

## The bug

Emilio: *"ibland försvinner räknaren, mellan en övning"* — the rest counter sometimes disappears between exercises. Confirmed reproduction: **it disappears once you leave the single set-logging screen** (moving toward the next exercise, back to the workout list, or the done/review screen).

## Mechanism [measured — from reading `views/Workout.jsx`]

The rest state is **workout-level** and persists: `activeWorkout.restEndsAt` (a timestamp) and `activeWorkout.restPausedRemaining` (paused ms). But the countdown UI **and its controls live only inside `WorkoutItemLive`** — the `RestBox` (Pause / Resume / Skip / +30s) is rendered there, and the 250 ms tick `setInterval` that updates the displayed time runs only while that component is mounted. So the instant you navigate off the set screen, nothing draws the timer, even though rest is still running underneath. (Two related gaps, not the report but worth knowing: no rest is started after an exercise's *final* set, and an exercise with `restSec === 0` starts none — both by current design.)

## The fix (DEC-003)

Lift the rest timer out of the single set screen into a **persistent, workout-level bar** rendered on **every in-workout screen** (the workout overview, an item's log screen, the item review, the finish screen), driven by the same `activeWorkout` rest state, with the **existing controls preserved** (Pause / Resume / Skip / +30s). Result: moving between exercises never loses the counter, and you can pause/resume it from anywhere in the workout.

## Scope

- One rest bar, sourced from `activeWorkout.restEndsAt` / `restPausedRemaining`, shown on all in-workout screens whenever a rest is active (or paused).
- The tick that updates the displayed remaining time runs at the bar's level, so it counts regardless of which in-workout screen is showing.
- Keep Pause / Resume / Skip / +30s working, and keep pause state across navigation.
- When rest reaches 0 (or is skipped), the bar clears — same end condition as today, just drawn in the persistent place.
- Remove the now-redundant in-`WorkoutItemLive` `RestBox` (or have it render the shared bar), so there is exactly one rest UI.

## Out of scope

- **Audible / haptic rest-end cue and wake-lock** — the separate Phase-1 backlog item; this req is only about the counter being visible/persistent, not about alerting when it ends.
- **Starting a rest after finishing an exercise / between exercises** — Emilio declined this; rest still starts only between sets.
- Showing the bar *outside* the workout entirely (Today/History/Settings) — in-workout screens only for this req.
- Any restyle beyond making the bar visible and usable (the full styling pass is its own item).

## Decisions (DEC-003, Emilio, 2026-09-07)

- Rest timer becomes a **persistent workout-level bar** on all in-workout screens (not a minimal in-place fix).
- Keep pause/resume/skip/+30s.
- Do **not** auto-start rest between exercises.

## Ordered steps

1. Introduce a shared rest-bar component driven by `activeWorkout` rest state + its own tick interval; place it in the in-workout shell so it renders across the workout screens ([inferred] — CC to choose the seam: the `Workout`/item screens share no wrapper today, so this may mean a small in-workout layout wrapper, or rendering the bar from each in-workout screen via one component). 
2. Move Pause / Resume / Skip / +30s into that shared component (they already exist in `RestBox`); remove the duplicate so there's one rest UI.
3. Ensure pause state and remaining time are read from `activeWorkout` (already persisted), so navigation and reload keep the timer correct.

## Acceptance criteria (written before implementation)

- **Persists across navigation (the bug):** start a between-sets rest, then navigate to the workout overview / next exercise / item review — the counter is still visible and still counting down on each. Verify in the running app (human "use it" gate).
- **Controls work from anywhere:** Pause on one in-workout screen, navigate to another → it shows Paused with the same remaining time; Resume continues it.
- **One rest UI (right mechanism):** there is a single rest bar — the old set-screen-only box no longer exists as a second copy (grep/diff shows one component).
- **End condition unchanged:** when the timer hits 0 or Skip is pressed, the bar clears and the set flow proceeds exactly as before.
- **Failure case:** navigating away and back mid-rest shows the *correct* remaining time (recomputed from `restEndsAt`), not a frozen or reset value.
- `./check` green; paste the line.

## Notes

This is the concrete bug behind the Phase-1 "rest cue + persistence" backlog line; building it resolves the persistence half. The end-cue + wake-lock half stays a separate item.
