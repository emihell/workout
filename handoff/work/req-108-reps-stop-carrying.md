# req-108 — a changed reps value no longer carries to the next sets; weight still does (batch 4, F9)

**Status: SPEC — READY, held for Emilio's go.** Phase 1. Behaviour change — **DEC-052** (narrows req-83).

From Emilio's in-app note (2026-09-18, push-ups): *"I think we added that set 1 change - also changes
set 2 - should not be that way - each set is separate from each other"*. Chosen 2026-09-23: **weight only**
carries.

## Why

[measured] req-83 (option (c), Emilio 2026-09-16) made a changed field seed the remaining sets of that
exercise this session: `nextSeedOverrides` (`src/workout-log.js:244`) records a changed **weight and**
a changed **reps**, and `setLogSeed` (`:196`) applies both. On push-ups (bodyweight, so reps only):
12 reps on set 1 instead of 15 → set 2 prefills 12. Reps targets are per set; the carry overrode them.

## The behaviour

- A **weight** entered differently from the seed still carries to the remaining sets of that exercise
  (warm-up / working separately, as now).
- **Reps no longer carry.** Every set prefills its own reps: its target for that set index (or the
  no-history carry of req-02 / DEC-002, unchanged).
- Nothing else about req-83 changes.

## Scope

`src/workout-log.js` (`nextSeedOverrides` / `setLogSeed`), `src/views/workout/item.jsx` if it passes reps,
`workout-log.test.js`.

## Out of scope

The req-02 no-history carry (kg+reps from the last working set when there is **no** history) — a separate
rule (DEC-002), not touched. Whether a weight change updates the routine template (still no).

## Order vs siblings

After req-106 (set preview). The preview must still match the form: re-check it.

## Watch-outs (CC)

- An active workout saved before this change may already hold `seedOverrides[…].reps`. It must be
  **ignored**, not applied. Don't rewrite the stored data; stop reading `reps` from the override.
- The req-83 tests asserting a reps carry are **changed by this req**. Edit them to assert the new
  behaviour and name the change in the diff (this is a behaviour reversal, not a weakening).

## Acceptance criteria

- **Reps separate (browser):** push-ups, targets 15/15/15 → log 12 on set 1 → set 2 prefills **15**.
- **Weight still carries (browser):** a weighted exercise, change 20→22 kg on set 1 → set 2 prefills
  22 kg, and its reps are that set's target.
- **Failure case — stale override (unit):** an active workout whose `seedOverrides` already holds a
  `reps` value → the seed reps come from the target, not the override.
- **Per-set targets (unit):** targets 10/8/6, set 1 logged with 9 → set 2 seeds 8, set 3 seeds 6.
- **Preview consistent:** req-106's preview lines equal the form's seed after a weight change.
- **No regression:** `./check` green.

## Decisions

- Weight carries, reps don't (Emilio, 2026-09-23) → DEC-052.
