**Status: BUILT AND MERGED, 2026-10-11 — branch `req-219` (`03c1612`…`63b31c1`, 2 commits).** **Lane: ui** — display only; no stored write.

# req-219 — "Last time" shows when the plan's kg differs; one-side exercises say "one side at a time"

DEC-122 §2 + Emilio 2026-10-10 on hints: "i only care if its empty or if its a weird number, if its the same numbrer as last time
,then i think its good and i dont care really where it came from". Planner proposed the hint widening; Emilio: "sounds good".
Builder: throwaway agent.

## Facts (rescanned 2026-10-10, `main` 98f94cf)

- `kgHints` (`src/kg-hints.js:24-33`): `lastTime = planned == null ? last : null` — "Last time: X kg" only when the routine has
  no kg at this set index. `bigJumpFrom`: typed kg differs from the reference by more than 50%.
- Rendered under the kg box (`src/ui/index.jsx:659, 749-755`): blank → "No weight entered[ · last time X kg]"; else
  "Last time: X kg"; plus "That's a big change from X kg".
- `kgLabelFor` (`src/kg-label.js:11`): "kg per dumbbell" when equipment names a dumbbell, else "kg".
- `isEachSide(exercise, library)` (`src/library-hints.js`, req-217) — library entry `unilateral: true` (62 entries, e.g.
  Concentration Curl, Dumbbell Step-Up, Turkish Get-Up, Hamstring Stretch); used on the log screen (`views/workout/item.jsx:218`)
  and the review (`:666`) for "Reps each side".
- Log screen head: `ExerciseHead` (`src/ui/index.jsx:788`).

## Scope

1. **Hint widening.** `lastTime` = the last-time kg whenever it exists and **differs from the routine kg** at that index (blank
   routine kg included, as today). Same kg → no note. The note text stays "Last time: X kg". `bigJumpFrom` unchanged.
2. **One side at a time.** When `isEachSide` is true, the log screen and the exercise review show a quiet line under the
   exercise head: **"One side at a time — all reps on one side, then the other."** For a dumbbell exercise the kg label stays
   "kg per dumbbell" (one bell is logged).

## Out of scope

Per-side (L/R) logging; volume; changing `bigJumpFrom`; hints on warm-ups or unweighted exercises (as today).

## Acceptance criteria

1. Unit (`kgHints`): routine 30, last 35 → lastTime 35; routine 35, last 35 → null; routine blank, last 35 → 35 (as before);
   no history → null.
2. **Failure case — "is the right mechanism answering?":** with a routine kg equal to last time, the note is absent even though
   history exists (asserts the comparison, not just presence).
3. Browser: seed a routine kg ≠ last workout's kg at set 1 → "Last time: X kg" under the box; a set whose routine kg equals last
   time shows no note.
4. Browser: One-Arm DB Row (library unilateral) shows the one-side line on the log screen and the review; Overhead DB Press
   doesn't. No library entry → no line.
5. `./check` green; smoke after commit.

## Decisions made on Emilio's behalf

- **behaviour** `(unconfirmed)`: the comparison is the routine kg (the number the app put in the box) against last time — not the
  typed value, so typing doesn't make the note flicker.
- **behaviour** `(unconfirmed)`: the line's wording, and "one side" (not "one arm") because the flag also covers legs and
  stretches.

## READY checks

1. DECs: DEC-102, DEC-122, DEC-119 §6, DESIGN §1 (the note names its source; never a prefill). 2. Siblings: req-10 touches the
   same kg area for no-history exercises (no history → no lastTime, so independent). 3. none. 4. 62 from `library/exercises.json`
   grep. 5. no trigger files. 6. marked.
