# req-42 — a recommendation with no valid increment holds (audit F-DIV-1)

**Status: BUILT AND MERGED, 2026-09-12 — branch `req-42` (`f548076`…`f548076`, 1 commit).** Decision made (DEC-030). From audit 2026-09-12 (F-DIV-1).
**Gate: functional** — `progress.js` is pure and unit-tested; the change is exactly
DEC-030's decided behaviour and deterministic. Planning verifies + merges. (It does
change the recommendation for `weightStep:'n/a'` exercises — note it at merge.)

## Why

`moveToValidWeight` (`progress.js:28`) invents a **±0.5 kg** step when the exercise
has no valid increments:
```
if (!options.length) return Math.max(0, Math.round((current + direction * 0.5) * 2) / 2)
```
Reachable for a `machine`/`free` exercise left at the `weightStep:'n/a'` default
(`store.jsx:172` `addExercise`) with a logged weight: the weighted-adjust branch
(`progress.js:80-88`) calls it, so the recommendation moves by a step the exercise
config never defines — an invented, untraceable load (breaks DESIGN §1/§2, and the
`recommendation is computed from history and nothing else`, using **valid**
increments). [audit F-DIV-1]

## The behaviour (decided — DEC-030)

With **no valid increment**, the recommendation **holds** — same load, `action:
'keep'`, no invented step. The user can still adjust manually. Rejected requiring a
`weightStep` first (adds a setup gate) and keeping the 0.5 kg default (it's invented).

## The fix (scoped to the no-increment case)

Two parts, both in `progress.js` (pure — no L-007 issue):

1. **`moveToValidWeight`:** when `options` is empty, `return current` (never invent).
   This makes it hold everywhere it's used (also DEC-012's setup calibration —
   holding rather than inventing is consistent there too).
2. **`recommendNextPrescription`:** in the weighted branch, when the exercise has
   **no valid increments**, hold — push the actual weight and **set neither
   `movedUp`/`movedDown`** (so `action` stays `keep`, reason `Same load.`). Otherwise
   an unchanged weight would still report `action: 'down'`/`'up'` — a recommendation
   that contradicts its own weight. Compute `hasIncrements =
   validWeights(exercise).length > 0` once (exercise is constant across the sets).

**Keep the has-increment behaviour exactly as-is** — including the at-ceiling/floor
case. This req only changes the *no-increment* path; do not broaden it.

## Scope

- `progress.js`: the two changes above.
- Tests in `src/progress.test.js` (pure).

## Out of scope

- A more informative reason string for the held case (e.g. "No valid increment —
  set one to progress"). Possible follow-up; DEC-030 decided the hold, not new
  messaging. Keep the standard `keep`/`Same load.`.
- Any change to `validWeights`, the `Alt 4/5` sequence, or bodyweight/cardio
  branches.
- The at-ceiling/floor flag behaviour for exercises that DO have increments.

## Ordered steps

1. `moveToValidWeight`: empty `options` → `return current`.
2. `recommendNextPrescription`: compute `hasIncrements` once; in the weighted
   up/down branches, only move + set the flag when `hasIncrements`, else push the
   actual weight (hold).
3. Tests (`node --test`, `progress.test.js`):
   - a `weightStep:'n/a'` weighted exercise, a logged set with `rpe <= 2` (would
     have gone up) → recommendation **holds**: weights unchanged, `action: 'keep'`.
   - same exercise, `missed`/`rpe >= 5` (would have gone down) → **holds**, `keep`.
   - `moveToValidWeight(w, { weightStep: 'n/a' }, 1)` and `(…, -1)` both `=== w`.
   - regression: an exercise **with** a valid step (e.g. `'5'` or `'Alt 4/5'`) still
     moves up/down as before (the existing `Alt 4/5` test stays green).

## Acceptance criteria (written before implementation)

- The no-increment cases hold with `action: 'keep'` — command: the new tests,
  output pasted.
- `moveToValidWeight` no longer invents 0.5 kg — grep/test shows the fallback gone.
- Existing `progress.test.js` (`Alt 4/5` up/down, recommend) stays green.
- `./check` green — paste the line.

## Decisions

- **behaviour (Emilio, DEC-030):** no valid increment → hold (`keep`), never invent
  a 0.5 kg step.
- **implementation (CC's call):** exact structure of the `hasIncrements` guard.

## Notes

Note at merge: this changes the recommendation for exercises with `weightStep:'n/a'`
(the `addExercise` default) — they now hold instead of drifting ±0.5 kg. Exercises
with a real `weightStep` are unaffected.
