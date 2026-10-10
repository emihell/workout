**Status: BUILT, NOT merged** **Lane: ui**

# req-216 — picker shows what you've added; Your exercises split by use

DEC-119 §5 (Emilio, H15 "maybe i can add, preview what i am adding then press done", H16 "show all added, maybe a small list", H2
"w fave i mea my excersises"). Builder: throwaway agent. Independent of req-212..215.

## Facts (rescanned 2026-10-10, `main` 25d366a)

- `ExercisePicker` multi-select: Checkbox rows, pinned `ui-picker-bar` with Cancel + "Add N" (`views/ExercisePicker.jsx:49,
  254-263`); picks show only as ticks (+ plan label, `:26-41`); "Your exercises" = all own, recent first; library rows hide items
  already owned (`:91`). Exercises already in this routine are not marked.
- BACKLOG req-180 follow-up: the sticky bar has no background (list shows through).
- `/exercises` (`views/Exercises.jsx:73-127`): every non-archived own exercise, grouped by type; no favourites in `src`.

## Scope

1. **Added strip:** above the picker bar, a one-line muted strip "Added: Row, Incline press, +2" in tap order, shown when ≥1 is
   ticked. Tapping a name unticks it. Give the bar (and strip) a background.
2. **Already in this workout:** in the routine's picker, rows of exercises already in that routine show "In this workout" as
   their meta line; they stay pickable (adding twice is allowed today).
3. **Your exercises** (`/exercises`, no search): two sections — **"In your workouts"** (in any active routine) and **"Not in a
   workout"** (the rest), each keeping today's type grouping. Search results stay one list.

## Out of scope

A favourite flag; deleting unused exercises; the mid-workout picker (unless it is the same component — then it gets 1 only).

## Acceptance criteria

1. Browser: tick 3 → strip lists 3 in tap order; tap one → unticked, "Add 2".
2. Browser: a routine with Row → Row's picker row says "In this workout".
3. **Failure case:** an exercise only in an archived routine is under "Not in a workout"; with no routines, every exercise is there
   and "In your workouts" is hidden (no empty header).
4. Unit for the split helper (active / archived / none).
5. `./check` green.

## Decisions made on Emilio's behalf

- **behaviour** `(unconfirmed)`: section names "In your workouts" / "Not in a workout"; strip text "Added: …".
- **behaviour** `(unconfirmed)`: already-added exercises stay pickable (marked, not blocked).

## READY checks

1. DECs: DEC-103 §2, DEC-104/106/107 (picker), req-180. 2. Siblings: none on these files in this batch. 3–5 none. 6. marked.
