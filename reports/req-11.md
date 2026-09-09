# req-11 — in-gym flow cleanup

Branch: `req-11-ingym-flow-cleanup`. Gate: **ux-feel** → waits for Emilio's use-it check.
Not merged.

## Technical

Four changes, per DEC-013. Files: `src/views/Workout.jsx`, `src/views/shared.jsx`,
`src/workout-log.js` (+ `src/workout-log.test.js`).

### 1. Rest-bar buttons (`RestBar`)
- Regrouped into a flex row: `[Pause/Resume] [+30s]` in a left `<span>`, `[Next]` on the far
  right (`display:flex; justify-content:space-between`).
- **Skip → "Next"**, same handler (`patchActive({ restEndsAt: null, restPausedRemaining: null })`)
  — ends the rest and shows the next set. No behaviour change, only label + placement.
- Inline flex style used because the app has zero CSS and "far right" is a layout requirement;
  appearance is for the use-it review.

### 2. Hide equipment/cues during rest (`WorkoutItemLive`)
- The `ExerciseSetupHeader` + `{ex.cues}` block is now wrapped in `{resting ? null : (…)}`. It
  still renders on the set-logging view (cues right before a set); the rest view is clean.

### 3. Back vs Previous (`WorkoutItemLive`, `WorkoutItemDone`)
- New shared `ExercisesLink({ routineId })` in `shared.jsx` → `‹ Exercises` anchor to
  `#/workout/${routineId}` (the overview = the exercise menu). Uses the app's existing anchor
  idiom (same as the overview's "Finish" and item links).
- Replaced the generic `<Back />` with `<ExercisesLink>` on both in-exercise screens.
- "Previous" (set-undo) unchanged. Result: one labelled overview-return + one labelled set-undo,
  never two generic back buttons.
- The **overview's own `<Back />`** (which *leaves* the workout) is left as-is — out of scope per
  the req note. It still reads "Back"; could be relabelled later, flagging for Emilio.

### 4. Drop the per-exercise review from the flow (`WorkoutItemLive`, `WorkoutItemDone`)
- Removed `goToItemReview`. New `markDoneAndGoToOverview(store, workout, routineId, item)`:
  marks the exercise done and returns to the overview with `{ replace: true }`.
- The three auto-review navigations now call it: the `!resting && plannedDone` effect, the
  `completeSet` done-branch, and the `skipSet` done-branch. So **completing (or skipping) the last
  set marks the exercise done and lands on the overview** — no review screen in the flow.
- The mark-done write moved out of `WorkoutItemDone`'s "Done" button into a **pure patch**
  `markItemDonePatch(workout, item)` in `workout-log.js` (adds the key to `completedItemIds`,
  clears rest). Testable without the DOM.
- `WorkoutItemDone` stays reachable by re-entering a completed exercise from the overview
  (`WorkoutItem` routes `completed → itemDonePath`). It is now a pure summary + "Add set" screen:
  the redundant "Done" button is **dropped** (the exercise is already done; the top `‹ Exercises`
  link is the return), "Add set" kept.

### The seam to watch (called out): re-entry "Add set" on an already-done exercise
Under the new flow an exercise is **always** in `completedItemIds` when its done screen is reached.
`WorkoutItemLog` has a `markedDone` guard that redirects a done item straight back to the overview
— so a naive "Add set → itemLogPath" would bounce and never let you log. (This path was only
reachable pre-req-11 from the not-yet-marked review screen, so the old "Add set" sidestepped the
guard by accident.)

Fix: **"Add set" now reopens the exercise** — `reopenItemPatch(active, item)` removes the key from
`completedItemIds` before `addWorkingSet` + navigate. Semantically right: adding a set means the
exercise isn't done until the new set is completed; finishing it re-marks done via the normal
last-set path. This is an implementation decision the spec left open (behaviour Emilio will see:
adding a set to a finished exercise un-checks it in the overview until the added set is logged) —
**flagging for a DEC/his confirmation.** Both patches are pure and unit-tested.

### 5. Remove the redundant Back from top-level main screens (DEC-015, folded in)
The persistent top nav reaches every top-level destination, so a history-`<Back/>` on a top-level
**main** screen is redundant; keep it only on drill-downs that return to a list.

**Finding — three of the four were already clean.** Only `Settings` actually had `<Back/>` on its
main screen; removed it (and its now-unused `Back` import). The other three mains already render no
`<Back/>`:
- **Schedule** main (`Schedule.jsx:26`) — no Back. The `<Back/>` at `:75` is in `ScheduleLoop` (a
  sub-screen), kept.
- **Exercises** main (`Exercises.jsx` return at `:88`) — no Back. The `<Back/>` at `:69` is inside
  the `if (type)` branch (`exercises-type` sub-screen), kept.
- **History** main (`History.jsx` return at `:192`) — no Back. The `<Back/>` at `:175` is inside the
  `if (month)` branch (`history-month` drill-down), kept.

So the peer instruction's premise ("each file has Back on both the main and sub-screens") held only
for Settings; the stated acceptance ("Settings / Schedule main / Exercises main / History main
render no `<Back/>`; their sub-screens still do") is met by the single Settings edit. All
drill-down / sub-screens across the four files keep their `<Back/>` unchanged.

## Verification

`./check` — green:
```
# tests 84  # pass 84  # fail 0
check: green — lint, 11 test file(s), and the build all passed.
```

New unit tests (`workout-log.test.js`), the "marked-done-after-last-set" transition and its
inverse, all passing:
- completing the last set → `plannedDone` true, `markItemDonePatch` adds the key + clears rest;
- mark-done idempotent, preserves other completed ids;
- `reopenItemPatch` removes only this item's key (the "Add set" reopen).

Also updated one stale test *title* — "marks an exercise done only after the review screen" →
"an exercise is marked done by completedItemIds membership". The assertion (pure
`itemIsMarkedDone` mechanics) is unchanged; only the description, which named the removed review
screen, was corrected.

### Domino check (mark-done timing)
- **Overview completion display** (`itemIsMarkedDone(active,item) || plannedDone`) — both true after
  the auto-mark, shows "· done". ✓ (logic)
- **All-done → Finish** — `FinishScreen`/`finishWorkout` do not depend on `completedItemIds`
  (`withSkippedUnloggedSets` fills them regardless), so Finish is unchanged. ✓ (logic)
- **Re-entry "Add set"** — fixed via `reopenItemPatch` (above); after logging the added set the
  last-set path re-marks done. ✓ (logic)

## What I could not verify myself (needs the browser / Emilio)
1. Rest bar reads `[Pause/Resume] [+30s] …… [Next]`; **Next** ends rest and shows the next set.
2. During rest the equipment/cues block is gone; it reappears on the set-logging screen.
3. Exactly one `‹ Exercises` on the exercise + re-entry screens (plus "Previous" for set-undo);
   no generic mid-exercise "Back".
4. Logging the **last set** jumps straight to the overview — no review screen — and the exercise
   shows done.
5. Tapping a **done** exercise opens its summary (today's sets + Previous) with "Add set"; "Add
   set" lets you log another set (the exercise un-checks until you finish it), and finishing it
   returns to the overview marked done again.
6. With everything done, "Finish" reaches the routine summary and saves.

## Workflow
- **Added (decision, needs recording):** "Add set" now **reopens** a completed exercise
  (removes it from `completedItemIds`). Necessary for "Add set" to work at all under auto-mark-done
  — otherwise the `WorkoutItemLog` markedDone guard bounces it. Candidate `DEC-`/`L-`: *"under the
  auto-mark-done flow, Add-set un-completes the exercise until the added set is logged."*
- **Dropped** `WorkoutItemDone`'s "Done" button entirely (spec allowed "plain return or drop it");
  the top `‹ Exercises` link is the single return, avoiding two overview controls.
- **Untouched (per scope note):** the overview's leave-the-workout `<Back />`. Noted it still reads
  "Back" and could be relabelled — CC's call was to leave it, since it's a genuinely different
  action and out of req scope.
- Kept both the explicit `if (done)` call and the `!resting && plannedDone` effect calling
  `markDoneAndGoToOverview` (as the pre-req-11 code kept both for `goToItemReview`): the explicit
  call avoids a one-frame flash of the empty logging screen; both are idempotent.
