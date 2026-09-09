# req-11 — in-gym flow cleanup: rest buttons, Back/Previous, drop the per-exercise review

**Status: READY** — decisions settled (DEC-013). A UI/flow req — READY on intent + constraints,
appearance refined at the use-it review. Touches the live-workout screens (`src/views/Workout.jsx`,
`src/views/shared.jsx`). Builds on `req-03` (rest bar) and the completion flow.

**Gate: ux-feel** (DEC-009) — a mobile in-gym flow. Planning builds + verifies the logic and the
flow in the browser, then **stops for Emilio's use-it check** before merge.

## Why

Four small frictions in the in-gym flow, from using it: the rest controls read awkwardly, a
generic "Back" collides with the set-level "Previous", clutter shows during rest, and finishing an
exercise forces an extra review screen before you can move on.

## Scope

### 1. Rest-bar buttons (the `RestBar`, ~`Workout.jsx:692`)
- Group **`[Pause / Resume]` and `[+30s]`** together (left).
- Rename **Skip → "Next"**, placed **far right**. "Next" keeps the current Skip behaviour: end the
  rest and advance to the next set (`patchActive({ restEndsAt: null, restPausedRemaining: null })`).
- Order/layout: `[Pause·+30s] ............ [Next]`.

### 2. Hide equipment/cues during rest only
- The `ExerciseSetupHeader` + `{ex.cues}` block (`Workout.jsx:407-408`) currently renders during
  both rest and logging. **Hide it while `resting`**; keep it on the set-logging view (cues help
  right before a set). Rest view = clean.

### 3. Back vs Previous (DEC-013)
- On the in-exercise screens (`WorkoutItemLive` and `WorkoutItemDone`), replace the generic
  `<Back />` (history-pop) with a clear semantic link to the **workout overview** —
  **"‹ Exercises"** (`go('/workout/${routineId}')`), the overview being the exercise menu.
- Keep **"Previous"** (undo last set) unchanged for set navigation.
- Result: one labelled way to the exercise list, one labelled set-undo — never two generic
  back-ish buttons. (The overview screen's own "Back" — which *leaves* the workout — is a different
  action; leave it, but it may read clearer as a labelled control too — CC's call, note it.)

### 4. Drop the per-exercise review from the completion flow (DEC-013)
- Today: finishing an exercise's sets auto-navigates to `WorkoutItemDone` (a review), where "Done"
  marks `completedItemIds` and returns to the overview.
- Change: **on completing the last set, auto-mark the exercise done** (write `completedItemIds`,
  clear rest) and **go straight to the workout overview** — no review screen in the flow. The
  auto-`goToItemReview` calls (`Workout.jsx:294, 334, 355`) become "mark done + go to overview".
- **Keep `WorkoutItemDone` reachable by re-entering a completed exercise** from the overview
  (tapping a done exercise already routes there via `WorkoutItem`). It becomes a pure
  view-summary + "Add set" screen; its "Done" button is now redundant (the exercise is already
  done) → make it a plain "‹ Exercises" return (or drop it), keep "Add set".
- The **whole-routine summary is unchanged** — it's the existing Finish screen (`FinishScreen`),
  reached from the overview's "Finish" once all exercises are done.

## Out of scope

- Any restyle beyond these button/label/visibility changes (the full styling pass is separate).
- The rest-end cue / wake-lock (separate items; wake-lock shipped as req-09).
- Changing what the Finish (routine summary) screen shows.
- The overview's leave-the-workout "Back" behaviour (noted, not required).

## Decisions (DEC-013)

- Rest buttons grouping + Skip→Next far right; equipment/cues hidden during rest only; Back→
  "‹ Exercises" on in-exercise screens with Previous kept; per-exercise review removed from the
  flow (auto-mark-done on last set → overview) but kept for re-entry. All Emilio's, 2026-09-09.
- Back/Previous approach chosen by the planning session per Emilio's "do what most similar apps do"
  (the overview is the exercise menu; a labelled link beats a generic history-Back).

## Ordered steps

1. `RestBar`: regroup Pause/Resume + +30s; rename Skip → Next and move it to the far right (same
   handler).
2. Gate the `ExerciseSetupHeader` + cues block on `!resting` in `WorkoutItemLive`.
3. Replace `<Back />` with a "‹ Exercises" link (→ `/workout/${routineId}`) in `WorkoutItemLive`
   and `WorkoutItemDone`; leave "Previous" as is.
4. Move the "mark done" (the `completedItemIds` write from `WorkoutItemDone`'s Done button) to the
   last-set-completion path, and change the auto-`goToItemReview` navigations to
   `go('/workout/${routineId}', { replace: true })`. Reconcile `WorkoutItemDone`'s buttons for the
   re-entry case.

## Acceptance criteria (written before implementation)

- **Rest bar:** during rest, the bar shows `[Pause/Resume]` + `[+30s]` grouped and `[Next]` at the
  far right; Next ends the rest and shows the next set (same as old Skip). (Browser check.)
- **Rest is clean:** no equipment/cues block during rest; the cues still show on the set-logging
  screen. (Browser check.)
- **No double back button:** on the exercise and re-entry screens there is exactly one
  overview-return control ("‹ Exercises") and, where applicable, "Previous" for set-undo — no
  generic "Back". Show it in the diff + browser.
- **Completion flow (the point):** logging the last set of an exercise marks it done and lands on
  the **workout overview** — no per-exercise review screen appears in the flow. (Browser check +
  a unit test on the "marked done after last set" state transition if the logic is testable
  without the DOM.)
- **Re-entry keeps the summary:** tapping a **completed** exercise in the overview still opens its
  summary (`WorkoutItemDone`) with its logged sets and "Add set". (Browser check.)
- **All-done → Finish still works (domino):** with every exercise completed via the new
  auto-mark-done path, the overview's "Finish" reaches the routine summary and the workout finishes
  and saves correctly. Assert the completion state drives Finish exactly as before (regression).
- `./check` green; paste the line.

## Notes

Behaviour change to watch (call out in the report): "mark done" moves from the review's Done button
to last-set completion. Verify the overview completion display, the all-done→Finish path, and
re-entry "Add set" (which adds a set to an already-done exercise) all still behave. This is the
first flow-restructuring req — keep the seam clean; the mark-done timing is the risky bit.
