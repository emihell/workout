# req-85 — timed exercises (duration sets) (N2 / batch-1 #6, gym-flow)

**Status: MODEL DECIDED 2026-09-16 — (a) orthogonal weight/duration flag (below); FULL SPEC + PERSISTED-
DATA CEREMONY PENDING before a batch — not yet buildable.** Emilio 2026-09-14: *"Time for timed
exercises."* Same feature as the 2026-09-10 note #6; unparked 2026-09-16.

**Gate: persisted-data + model + UI** (schema-version bump; ask-gate applies).

## Why

An exercise should be able to carry a **weight and/or a timer**. A timed exercise (e.g. plank)
shows a count-**down** during the set that you start, with a sound at zero. [measured] exercises
have `restSec` already (`model.js:41`) but **no per-set work duration**; `EXERCISE_TYPES =
['machine','free','bodyweight','cardio']` (`ids.js:51`) has no "timed" concept. Rowing already
uses a "Duration" field (cardio) — a duration concept **partly exists** and may inform the shape.

## Model decided (Emilio, 2026-09-16): (a) orthogonal weight/duration flag

Any exercise can carry a **weight and/or a duration** — a flag on the exercise, **not** a new type,
so an exercise can be weighted, timed, or both (matches Emilio's framing; Rowing's existing "Duration"
shows a duration concept can coexist with type). (b) new `'timed'` `EXERCISE_TYPES` value **rejected**
(rigid: timed OR weighted, never both).

**In scope (Emilio, 2026-09-16):** a timed exercise needs a real **in-set countdown timer** — you
start it, it counts down during the set, with a **sound at zero** (reuses the rest-end-cue work).

**Full spec + persisted-data ceremony still to be written before this enters a batch:**
- **What changes and to how many records** — the store schema-version bump for the new duration
  field; state it before touching the store (ask-gate #2 / DEC-035 carve-out → Emilio's eyes).
- **A migration round-trip test** proving older `localStorage` keys survive the bump.
- **Back up first** (Settings → Export) before merge (DEC-046) — Planner reminds Emilio at that point.
- The countdown UI + the start/stop/complete interaction with the existing set-log flow.

## Persisted-data ask-gate (when this revives)

- State what changes and to how many records **before** touching the store.
- A **migration test** proving older `localStorage` keys survive the schema bump.
- **Back up first** (Settings → Export) before merge (DEC-046).

## Scope / acceptance

Written once the model is picked. Must include:
- A migration round-trip test (old key → upgraded, no data lost).
- A test that a **non-timed** exercise is unaffected (failure case).
- The countdown + end-cue behaviour, testable.

## Decisions

- Model shape (a) vs (b) (Emilio) — blocks everything.
