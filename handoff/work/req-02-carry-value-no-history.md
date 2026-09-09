# req-02 — carry the entered kg + reps across sets for a no-history exercise

**Status: READY** — decisions made (DEC-002). Independent of `req-01`; can build in either order.

**Gate: functional** (DEC-009) — logging/flow behaviour the planning session can browser-verify; planning closes it without a human gate.

## Why

For an exercise with **no finished-workout history**, the live log seeds no weight (and reps only from the per-set target), so the user retypes the same kg on every set while calibrating. Emilio: *"övning utan historik: skriv in första värdet i första settet, värdet följer med resten av setsen"* — type the value in set 1, it follows to the rest.

This does **not** invent data: the carried value is what the user just entered **this session**, not a fabricated plan. It only fills what would otherwise be blank, and stays an editable prefill.

## Scope

- Applies **only when the exercise has no history** (`historyPrescription`/`lastSetsForExercise` return nothing for it). An exercise *with* history keeps its existing per-set history prefill, unchanged.
- When logging a working set of such an exercise, seed the form from the **most recently logged, non-skipped working set of this item in the current active workout**:
  - **kg** — carried (only for weighted exercises; bodyweight/cardio have no kg).
  - **reps** — carried (overriding the per-set target, per DEC-002).
- "Most recent" means it follows forward as you go: set 2 seeds from set 1, and if you change kg/reps on set 2, set 3 follows set 2 (DEC-002).
- Effort is **not** carried — it stays at its Moderate default each set (unchanged; effort is a per-set judgement).
- The seed is an editable prefill, never a lock. The first working set (nothing logged yet) is unchanged: kg blank, reps from target.

## Out of scope

- Exercises that *have* history (their per-set prefill is untouched).
- Warm-up (WU) sets — unaffected; they keep their own warm-up prefill.
- Carrying effort/RPE.
- The partial-history case (history exists but for fewer sets than today) — a possible later extension, not this req.

## Decisions (DEC-002, Emilio, 2026-09-07)

- **kg and reps both carry** (not kg alone).
- **Follows the most recent logged working set** (not always set 1).

## Ordered steps

1. In the live set-log seed logic (`views/Workout.jsx` — `WorkoutItemLive` / `SetLogForm`; [inferred], CC to confirm the exact seam), add a fallback used **only when the exercise has no history**: the most recent non-skipped logged working set for this item in `active` (e.g. the last of `itemLoggingState(active, item).workLogged` that isn't `reps === 'skipped'`).
2. Seed order for a working set becomes: **restore (from "Previous")** → **history prefill** (if the exercise has history) → **carried last-set value** (no-history only) → **blank kg / target reps** (first set). kg carries only for weighted exercises.
3. Do not change the with-history path, the WU path, or effort defaulting.

## Acceptance criteria (written before implementation)

- **Carry (main):** a no-history **weighted** exercise, set 1 logged at 40 kg × 10 → set 2's form is prefilled 40 kg × 10 (both fields). Verified in the running app + a unit/logic test if the seam is testable without the DOM.
- **Follows most recent:** change set 2 to 42.5 kg × 8 and log it → set 3 prefills 42.5 × 8, not 40 × 10.
- **Editable, not locked:** the prefilled set 2 can be overwritten before logging.
- **Scope guard (right mechanism):** an exercise **with** history still prefills per-set from history, not from the previous live set — assert the two paths don't cross. And the **first** working set of a no-history exercise is still blank-kg / target-reps.
- **Skipped source ignored (failure case):** if the most recent working set was **skipped**, the next set does not prefill `reps: "skipped"` / `0 kg` — it falls back to the last non-skipped logged set, or to blank/target if none.
- `./check` green; paste the line.

## Notes

This is a Phase-1 gym-flow item (less retyping during calibration). It overlaps the same area as `req-01` (the logging flow) but touches the seed/prefill path, not the save path, so they're independent.
