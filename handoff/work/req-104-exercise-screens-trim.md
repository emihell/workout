# req-104 — exercise screens: drop "Previous" from the done view, smaller exercise title (batch 4, F3+F5)

**Status: SPEC — READY, held for Emilio's go.** Phase 1. **[ux-feel]**

From Emilio's in-app notes (2026-09-18):
- F3, `/workout/…/item/…/done`: *"Don't need to show previous"*
- F5, `/workout/…/item/…/log`: *"The exercise title - can be much smaller, no need for it to take this
  big space"*

## Why

[measured] `WorkoutItemDone` (`src/views/workout/item.jsx`) renders a **Today** section, then a
**Previous** section (the last finished workout's sets, `lastSetsForExercise`). `ExerciseTitle`
(same file) wraps the name in the page-level `Title`, so on the log screen the exercise name is the
largest thing on screen.

## The behaviour

1. **Done view:** remove the `Previous` section header and its list / "None." line. Today's sets,
   Add set, and the exercise header stay.
2. **Exercise title** (`ExerciseTitle`, used by both the log and done views): noticeably smaller,
   still clearly the heading of the screen. The "Add note" control beside it (req-80) and the meta
   line (`WU set`, `2/4`) stay aligned with it.

## Scope

`src/views/workout/item.jsx`; `src/ui/ui.css` (prefer a class/modifier over changing the shared `Title`
for every screen).

## Out of scope

The page `Title` on other screens; the history screens' "previous" data; any set-log form change.

## Order vs siblings

Touches `item.jsx` like req-106 (set preview), req-108 (reps carry) and req-109 (skip/swap). Build
**104 → 106 → 108 → 109**.

## Acceptance criteria

- **No Previous (browser):** a done exercise with finished history shows no "Previous" header or rows.
- **Failure case — no history:** a done exercise with no finished history shows no stray "None." under a
  missing header.
- **Smaller title (browser, screenshot):** the log-screen exercise name is visibly smaller than before
  and "Add note" still sits beside it, not wrapped under it, at 390px width.
- **Other screens unchanged:** Today / Routine titles render at their current size.
- **No regression:** `./check` green; `lastSetsForExercise` stays (still used by the log screen).

## Decisions

- Remove Previous; smaller title (Emilio, 2026-09-18 notes).
- The size — implementation (CC), within "much smaller, still the heading".
