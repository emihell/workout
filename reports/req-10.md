# req-10 — first-time guided setup (DEC-012 as amended by DEC-123 §1)

Branch `req-10`, built on `origin/main` 07faaa3. Code commit fa04988.

## Technical

**What changed**

- `src/first-time-setup.js` (new, pure):
  - `setupPromptShows`: the "First time — [Set it up] [I'll enter it]" prompt shows when there is no
    finished history (`lastSetsForExercise` null), the type is weighted or bodyweight (not cardio, not
    `hasDuration`), it's the first work set (no work set logged), and the prompt is unanswered.
  - `setupSheetShows`: after set 1's Done, only in setup mode, asked once, only when there is a set 2
    (not the finishing set), set 1 wasn't skipped, and (weighted) set 1 has kg > 0.
  - `setTwoSeed`: runs `recommendNextPrescription` on set 1 alone, judged against set 1's own target,
    with the answer as the rpe it hands over (Easy 2 / Medium 3 / Hard 4, never written anywhere).
    Weighted: Easy → `moveToValidWeight(+1)`, Medium/Hard → same kg, missed reps → one step down
    whatever the answer. The helper's holds (assisted, target not a single number, lightest weight,
    no step) keep the kg, and the reason line says which hold. Bodyweight: set 2's reps = its own
    target ±1 (never below 1). Skip / no answer → null, so set 2 gets the plain carry.
- `src/workout-log.js`: `setLogSeed` / `initialSetFields` take an optional `setup` seed, which ranks
  above override / routine kg / carry for the fields it carries. Absent means byte-identical
  behaviour. `setupSeedFor(workout, item, setType, workIndex)` returns the seed only for the work set
  it names, on its own item. `setPreview` / `setListRows` apply it, so the set list's row 2 matches the
  form. `finishedState` drops `firstTimeSetup`.
- `src/views/workout/item.jsx` (`WorkoutItemLive`):
  - The prompt, the set-1 guide line and the set-2 reason line render above `SetLogForm`. SetLogForm
    itself is untouched (req-219 conflict).
  - `completeSet` on work set 1 calls `askHowItFelt` → `askChoice` (the existing ConfirmSheet).
    Choices are Easy / Medium / Hard; cancel is labelled "Skip".
  - A keyed `Fragment` around the form remounts it once when the seed lands. The form is still keyed
    by `setSeedKey`.

**Where the answer lives:** `activeWorkout.firstTimeSetup[exerciseId] = { mode: 'setup'|'manual',
answered?, seed?: { itemKey, workIndex: 1, weight?, reps?, reason } }`.
- It is optional and transient, like `seedOverrides` / `setDraft`. No schema bump and no migration.
- Load path: `migrateState` → `workoutSnapshot`'s spread keeps it on the active workout (test:
  "migrateState keeps it").
- `finishedState` strips it, so it never reaches history (test: "finishedState drops it").
- It is never written onto a set: set 1 and set 2 keep `rpe: null` (rendered assertion).

**Receipts**

- `node --test src/req-10.test.js` → `ℹ tests 28 … ℹ pass 28 ℹ fail 0`. That covers:
  - set-2 seed cases: Easy / Medium / Hard / missed / no step (n/a, blank) / Alt 4/5 / Steps 4/5 /
    lightest-weight floor / assisted / range target / bodyweight ±1 / failure nulls;
  - prompt and sheet conditions;
  - the seed seam;
  - transient-state load and finish;
  - 7 rendered tests on one StoreProvider with the real ConfirmSheet: prompt → Set it up → set 1 blank +
    guide → Done → sheet → Easy → set 2 = 22.5 with "Up one step — set 1 felt easy", editable, stored
    rpe `[null, null]`; routine-kg case; Skip → plain carry, no reason; history → no prompt / no sheet;
    I'll enter it; bodyweight reps 10 → 11; cardio → no prompt.
- `./check` → `check: green — lint, skills, no import cycles, 115 test file(s), and the build all passed.` (1755 tests pass)
- `node scripts/smoke.mjs`, run after commit fa04988 → `smoke: green — 12 steps (build 0.4s, browser 4.5s)`

**Choices the spec left open**

1. **A kept suggestion carries to sets 3+.** req-83's comparison base is the seed *without* the
   suggestion, so set 2 logged at the suggested kg becomes this session's kg override (DEC-052). With a
   blank routine kg this is identical to the plain carry. With a routine kg [20,20,20], Easy → set 2
   22.5 → set 3 22.5 (not back to 20).
2. **Prompt placement.** The prompt sits above the form and the form stays usable. Logging set 1
   without answering = I'll enter it, so no sheet appears.
3. **Guide line placement.** The guide line sits above the form, not literally "under the kg box", so
   SetLogForm stays untouched (req-219). Bodyweight gets its own guide: "Do the reps you can do with
   good form. Log the set, then tell us how it felt."
4. **No sheet in some cases.** No sheet when set 1 is also the last set (nothing to seed), when set 1 is
   skipped, or when a weighted set 1 has no kg (nothing to step from, so never an invented kg).
5. **Navigation dismisses the sheet.** Backdrop / Escape / navigating away answers the sheet as Skip,
   and it is remembered (`answered: 'skip'`), so it never re-asks.
6. **"Once per exercise per workout"** is keyed by `exerciseId`. The seed itself is tied to the item it
   was asked on.
7. **Reason wording for holds:**
   - "Same kg — set 1 felt medium/hard"
   - "Down one step — set 1 missed reps"
   - "No weight steps set for this exercise"
   - "Same kg — already the lightest weight"
   - "Same kg — assisted, kept as is"
   - "Same kg — the target isn't a single number"
   - "Same reps — already at 1 rep"
   - Easy at the top of a fixed `weightOptions` list holds rather than stepping down.

## Workflow

- **Test edit:** `src/req-122.test.js` Actions count 21 → 22, for the prompt's `<Actions>` row
  (I'll enter it / Set it up). This follows the same pattern as every earlier req that added a row; the
  comment is extended.
- **Not a test edit, but flagged:** req-125's static test requires `key={setSeedKey}` on SetLogForm.
  I kept that and added a keyed `Fragment` around the form for the one remount when the seed lands.
  The draft is still read once per set.
- **`initialSetFields` latent effort default (rescan note):** left untouched, out of scope.
- **Copy marked `(unconfirmed)` is as specced** ("First time", "Set it up", "I'll enter it", "about 15
  times", "Up one step — set 1 felt easy"). Plus the extra hold, bodyweight and guide wording above.
  All of it is Emilio's at the ux-feel gate.
- **Candidate DEC:** choice 1 (accepting the suggestion counts as this session's kg change).
- `handoff/` untouched. Not merged, not pushed.
