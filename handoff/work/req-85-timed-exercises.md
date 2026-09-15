# req-85 — timed exercises (duration sets) (N2 / batch-1 #6, gym-flow)

**Status: NEEDS DECISION — PARKED on model shape (Emilio, 2026-09-10; re-raised 2026-09-14).**
Emilio 2026-09-14: *"Time for timed exercises."* Same feature as the 2026-09-10 note #6.

**Gate: persisted-data + model + UI** (schema-version bump; ask-gate applies).

## Why

An exercise should be able to carry a **weight and/or a timer**. A timed exercise (e.g. plank)
shows a count-**down** during the set that you start, with a sound at zero. [measured] exercises
have `restSec` already (`model.js:41`) but **no per-set work duration**; `EXERCISE_TYPES =
['machine','free','bodyweight','cardio']` (`ids.js:51`) has no "timed" concept. Rowing already
uses a "Duration" field (cardio) — a duration concept **partly exists** and may inform the shape.

## Open decision (Emilio) — the model shape

- **(a) an orthogonal weight/duration flag** on any exercise (weight and/or duration), vs
- **(b) a new `EXERCISE_TYPES` value** (`'timed'`).

Nothing is specced until this is picked. The "sound at zero" reuses the still-open rest-end-cue
backlog item.

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
