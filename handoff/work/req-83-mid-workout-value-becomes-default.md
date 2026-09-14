# req-83 — a set value changed mid-workout becomes the future default (N9, gym-flow batch 2)

**Status: NEEDS DECISION — saved 2026-09-14, not scheduled. Brushes the core prefill rule.**
From Emilio's 2026-09-14 notes: *"If I change a set setting during a workout — e.g. 4kg to 5kg
during warm-up — that should be the default for all future workouts."*

**Gate: persisted-data / behaviour.**

## Why / what already happens

[measured] prefills already come from the **last finished workout's** per-field value
(history-prefill rule, DESIGN §1; req-17 `initialSetFields`). So once **this** workout finishes
with 5kg, the next workout's prefill is **already** 5kg. The ask is only about what should happen
**beyond** that existing behaviour.

## Open decision (Emilio)

- **(a) nothing new** — history already delivers it after finish (close as a no-op / doc note).
- **(b)** update the **routine template's** prescribed value (immediately, or on finish) — a
  template edit made from inside a workout.
- **(c)** apply the change **live to the remaining sets** of the same workout.

(b) and (c) may both be wanted.

## Guard rails (any direction)

- **Never invent data (DESIGN §1):** propagate only values the user actually entered; a field the
  user did **not** change must not be altered.
- History-prefill must still draw **only** from finished-workout data.

## Scope / acceptance

Written once the direction is picked. Provisional acceptance must include:
- A value the user did **not** change is **not** altered anywhere (failure case).
- History-prefill still sources only from finished workouts (regression test).
- `./check` green; migration test if any stored shape changes.

## Decisions

- (a)/(b)/(c) (Emilio) — blocks READY. (b)/(c) trigger the persisted-data ask-gate.
