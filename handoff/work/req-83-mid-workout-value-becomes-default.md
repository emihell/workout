# req-83 — a set value changed mid-workout becomes the future default (N9, gym-flow batch 2)

**Status: READY — Emilio picked (c) apply live to the same session's remaining sets, 2026-09-16.**
Note: the "future default" half is **already handled** — history prefills the last *finished* workout's
per-field value ([measured] `historySetPrefill`/`lastSetsForExercise`, warm-up matched to warm-up), so
(a) needs nothing. This req is only the **immediate/live** half: propagate a mid-workout change to the
rest of *this* session so it doesn't wait for finish. From Emilio's 2026-09-14 notes: *"If I change a
set setting during a workout — e.g. 4kg to 5kg during warm-up — that should be the default."*

**Gate: behaviour (live session state; persisted-adjacent — writes to `activeWorkout`, but NOT a
schema-version bump: an optional field on the transient active workout, cleared at finish).**

## Why / what already happens

[measured] prefills already come from the **last finished workout's** per-field value
(history-prefill rule, DESIGN §1; req-17 `initialSetFields`). So once **this** workout finishes
with 5kg, the next workout's prefill is **already** 5kg. The ask is only about what should happen
**beyond** that existing behaviour.

## The behaviour (decided: (c) live-apply, Emilio 2026-09-16)

When the user enters a value on a set's log form that **differs from the seeded value**, that value
becomes the seed for the **remaining not-yet-logged sets of the same exercise in this session** —
until the user changes it again. So: bump warm-up 4→5kg (or a working set's weight), and the later
sets of that exercise this session prefill 5kg instead of the history/target value.

- **Only the field the user actually changed propagates.** If they change weight but not reps, reps
  keep seeding as before, and vice-versa. A field left at its seed is not treated as "changed."
- **Same exercise only.** A change never crosses to another exercise (or another exercise's sets).
- **Warm-up vs working:** a change made on a working set carries to later working sets; a change on a
  warm-up set carries to later warm-up sets of that exercise. (CC: keep the wu/work separation the
  seed already uses.) *Open impl question for CC to resolve and report: does a warm-up change also
  seed the first working set? Default NO — wu and work seed independently today; keep that unless it
  reads wrong, and flag it.*
- This is **live/session** only. It does **not** write the routine template (option (b) not chosen)
  and does **not** change history-prefill, which still draws **only** from finished workouts.

Mechanism is CC's (a session-scoped override on `activeWorkout`, or seeding the next set from the last
logged set of this exercise this session) — note this is adjacent to the req-27 `nextSetWeight` that
req-78 removed, but **broader** (all remaining sets, not one) and **live** (not tied to the rest panel,
which is gone). Keep the decision inspectable, like the prefill rule.

## Guard rails

- **Never invent data (DESIGN §1):** propagate only values the user actually entered; a field the user
  did **not** change must **not** be altered anywhere.
- History-prefill must still draw **only** from finished-workout data — unchanged.

## Acceptance criteria

- **Live carry (browser):** change a set's weight, complete it → the next set of that exercise prefills
  the new weight, not the old seed.
- **Field isolation (failure case):** change only weight → reps on the next set are unchanged
  (still the normal seed); change only reps → weight unchanged. A field never invented.
- **No cross-exercise leak:** the changed value does not appear on any other exercise's sets.
- **History rule intact (regression):** history-prefill still sources only from finished workouts;
  an unfinished mid-workout change does not alter any other stored/finished workout.
- **No regression:** `./check` green. (No schema-version bump expected; if CC adds a stored field to
  `activeWorkout`, a test that an older active-workout key still loads.)

## Decisions

- (c) live-apply chosen; (a) is already delivered by history after finish; (b) template-write **not**
  built (Emilio, 2026-09-16). Reversible — (b) can be added later if wanted.
- Warm-up→first-working-set carry: CC default NO, flag if it reads wrong (above).
- Override mechanism — implementation (CC).
