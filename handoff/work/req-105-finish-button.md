# req-105 — workout overview: Finish becomes a bottom button, prominent once everything's done (batch 4, F6)

**Status: SPEC — READY, held for Emilio's go.** Phase 1. **[ux-feel]**

From Emilio's in-app note (2026-09-18, `/workout/sess-push-pull`): *"Last exercise and finish - if finish
is gonna be a part of the list - make it the last press of the list - or make its own thing at the
bottom. If all exercises are done - finish should be easly pressen - so maybe make it into a floating
button or something could be nice"*. Chosen 2026-09-23: **bottom button**, prominent when all done (not
floating).

## Why

[measured] `src/views/workout/overview.jsx` renders Finish as a lone `Row` in a second `List` directly
under the exercise list, so it reads as another exercise. When every exercise is done the req-84
`AutoCompleteSummary` replaces the list; after **Cancel** the list returns (every row muted `· done`) with
the same plain Finish row under it (`overview.jsx:123`, `:134-161`). [review 2026-09-23]

## The behaviour

- Finish is a **button at the bottom** of the overview, above Abandon — no longer a list row.
- **Not all done:** a secondary (non-primary) button.
- **All done** (the same `allDone` test the auto-complete uses) — i.e. after the summary is cancelled:
  the **primary**, full-width button.
- Extract the inline `allDone` test (`overview.jsx:120`) as a pure `allItemsDone(active)` in
  `src/workout-log.js`, used by both the summary gate and the button, so it's unit-testable (req-109 reuses it).
- It still goes to `/workout/:routineId/finish`. It navigates without writing, so per **DEC-040** it is a
  `NavLink` wearing the button look, not a `<Button>` with `go()`.

## Scope

`src/views/workout/overview.jsx`; `src/workout-log.js` + test (`allItemsDone`); `src/ui/ui.css` if needed.

## Out of scope

The auto-complete summary itself (req-84); the Finish screen; a floating/sticky button (not chosen); the
empty-workout branch (no exercises → Abandon only, unchanged).

## Order vs siblings

req-107 (workout note) and req-109 (skip/swap) also edit the overview. Build **105 → 107 → 109**.

## Acceptance criteria

- **Not a row (browser):** Finish is a button at the bottom, visually separate from the exercise list,
  above Abandon.
- **Prominent when done (browser):** finish every exercise → Cancel the summary → Finish is the primary
  full-width button.
- **Failure case — nothing logged:** a just-started workout shows Finish as the secondary style (not
  primary), and it still opens the Finish screen.
- **Right mechanism (unit):** `allItemsDone` is false with the last item done and the first open; true only
  when every item is done (marked done or planned-done).
- **No regression:** `./check` green.

## Decisions

- Bottom button, primary when all done (Emilio, 2026-09-23).
- NavLink-with-button-look per DEC-040 — implementation.
