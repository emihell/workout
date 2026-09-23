# req-109 — skip a whole exercise, or replace it with another, mid-workout (batch 4, F2+F8)

**Status: SPEC — READY, held for Emilio's go.** Phase 1. **[persisted-data]** + **[ux-feel]**. No
schema-version bump, but it touches the **shared migration path** (`src/model.js` `workoutSnapshot`),
which runs on the active workout on every load → **independent reviewer required before merge** (DEC-035).

From Emilio's in-app notes (2026-09-18, `/workout/sess-push-pull`):
- F2: *"If i can't do a machine i should be able to add another exercixe"*
- F8: *"Add ability to skip whole exercise?"*

On the replacement (2026-09-23): *"replacement should only be for this one time only, replacement are only
done when the machine you want is taken, usually during warmup … as the warm up can be anything, it should
be a blank state - copying form the existing wamrup is guessing they are similar"*. The blank state below:
"sounds good".

Revised 2026-09-23 after an external review (the first draft's "transient, no model change" framing was
wrong. See **Why**).

## Why

[measured]
- Only per-set Skip exists (`skipSet`, `src/views/workout/item.jsx`). The items are a snapshot fixed at
  Start, and nothing adds or replaces one.
- At finish, `withSkippedUnloggedSets` (`src/workout-log.js:75`) records unlogged sets with `skippedSet` (`:56`).
- **`migrateState` rewrites the active workout's snapshot on every load** (`storage.js:170` →
  `model.js:285` → `workoutSnapshot`, `model.js:80`). For each item, `workoutSnapshot`:
  - matches a routine template item by id **or by `exerciseId`** (`:86-89`);
  - sets `routineItemId: item.routineItemId || … || templateItem?.id` (`:104`);
  - backfills empty `targets` / `suggestedWeights` from `legacyRecommendations[templateItem.id]` or from
    this workout's working sets matched by `exerciseId` (`:92-98`, `:109-114`).

  The reviewer's probe showed two failures for a replacement exercise that is also in the routine:
  - after a reload it inherits the template's id, and at finish its sets are **written onto the routine
    template** (`template row after finish: [30,99]`);
  - its "blank" targets and weights are backfilled from the routine's copy (`targets:["10","10"]`,
    `suggestedWeights:[30]`) or from its own logged set.

## The behaviour

**Skip exercise:** a control on the exercise's log screen, labelled **Skip exercise**.
- It needs **two taps**: the first changes it to "Tap again to skip", and that resets after a few seconds.
  No native confirm.
- It logs every remaining (unlogged) set of that exercise as skipped, using the `skippedSet` record. Then
  it marks the exercise done and returns to the overview. Sets already logged stay.

**Overview "skipped" state:** an item whose sets are **all** skipped reads **skipped** on the overview,
where it would otherwise read `· done`. An item with at least one logged set reads done. The rule is
derived from the sets alone, so it needs no stored marker.

**Replace exercise:** a control on the exercise's log screen, labelled **Replace exercise**. It opens a
picker of the library's exercises, excluding archived ones. Cancel on the picker changes nothing.
Picking one:
1. **Skips the original**, exactly as Skip exercise does.
2. **Inserts the picked exercise directly after the original**, in a **blank state**:
   - 1 working set, no reps target, no suggested weight, no warm-up set;
   - **role = the original's**, so a warm-up replacement still reads as a warm-up;
   - **rest = the rest from its own last finished snapshot** (`historyPrescription(...).restSec`,
     `storage.js:375`, the source `Routine.jsx:384` already uses), else none.
3. **Prefill follows the normal rule:** the picked exercise's own history, with DEC-053 / req-111 applied.
   **Nothing is copied from the original.**
4. **More sets** come from the existing **Add set** on its done view.
5. **This workout only.** The routine template is never changed, at replacement, on reload, or at finish.

**Accepted, explicitly:** a mis-picked replacement can't be removed. If left unlogged, it's recorded as
skipped at finish. Removing a replacement is out of scope.

## Required mechanism (the review's two blockers)

- The inserted item carries its own **unique `routineItemId`**, not only an `id`. The id must not match any
  routine template item. `applyProgressionToRoutines` (`model.js:295`) matches by `routineItemId`, so
  without a template match it is a no-op.
- The inserted item is **marked as added mid-workout** (e.g. `adHoc: true`). `workoutSnapshot` must skip,
  for it, **both** the template match (`:86-89`, `:104`) and the targets/weights backfill (`:109-114`).
  Existing items keep their current behaviour.

## Scope

- `src/views/workout/item.jsx` and `overview.jsx`;
- a picker screen (route is CC's choice; reuse the router's patterns, DEC-051);
- `src/workout-log.js`: pure skip-remaining / insert-item / item-skipped helpers, plus tests. Reuse
  `allItemsDone` from req-105;
- **`src/model.js` `workoutSnapshot`**, and the store's active-workout path.

## Out of scope

- Adding an extra exercise without replacing one; removing an inserted one; reordering.
- Replacing an already-done exercise (re-open it first).
- Creating a new exercise from the picker.

## Order vs siblings

- **Last of batch 4.** After req-104, 106, 108 (`item.jsx`), req-105 and 107 (`overview.jsx`).
- After **req-111**, since prefill after a skip depends on it.

## Watch-outs (CC): same exercise twice

A replacement can be an exercise already in this workout. The review found these `exerciseId` couplings;
confirm each, and fix or report it:
- `seedOverrides` is keyed `exerciseId::setType` (`workout-log.js:213`), so a weight change on one item
  seeds the other. That's acceptable ("same exercise", req-83); state it in the report.
- Next session, `lastSetsForExercise` / `historySetPrefill` merge both items' sets (`storage.js:348-372`).
  Say what the next prefill shows.
- The Finish and summary set counts include skipped sets (`finish.jsx:28`, `storage.js:432`). Unchanged,
  but note it.
- Every reader of `targets` / `suggestedWeights` / `warmup` must accept the blank item: the log form,
  req-106's preview, beat-last-time, Finish, history detail and edit.

## Acceptance criteria

- **Skip (browser):** a 3-set exercise with 1 set logged → Skip exercise, tap twice → overview, row reads
  **done**. Finish → history shows 1 logged + 2 skipped.
- **Skip all (browser):** an unlogged exercise → Skip exercise → the row reads **skipped**.
- **Mis-tap guard (browser):** one tap, then wait → nothing is skipped and the label resets.
- **Replace (browser):** replace an exercise → the original reads skipped, and the picked one sits directly
  under it with 1 set, no target, no kg (for an exercise with no history).
- **Failure case — no copying (unit):** the original has targets 10/8/6 and weights 40/45/50, and the picked
  exercise has no history → the inserted item has no targets, no weights, no warm-up.
- **Failure case — survives reload (unit):** insert a replacement whose exercise **is also in the
  routine**, run `migrateState` on the state → the item keeps its own `routineItemId` and stays blank.
  Repeat after logging one set on it (60×7) → still no backfilled targets or weights.
- **Template untouched (unit):** from that reloaded state, finish with `buildFinishProgression` +
  `applyProgressionToRoutines` → the routine's exercises (ids, targets, weights) equal those of the same
  workout without the replacement.
- **Right mechanism — own history (unit):** replace with an exercise that has finished history → its set-1
  seed equals `initialSetFields` from that exercise's history, not the original's.
- **Auto-complete (unit):** a skipped item counts as done in `allItemsDone`.
- **No regression:** `./check` green, with no `STORAGE_KEY` / schema-version change. An existing active
  workout with no mid-workout items migrates exactly as before (existing model tests unmodified).

## Decisions

- Skip exercise = remaining sets logged skipped, with a two-tap guard (Emilio, 2026-09-23).
- Replace = the original skipped, plus a blank replacement using only its own history, for this workout
  only (Emilio, 2026-09-23).
- A row reads skipped only when all its sets are skipped. This rule is Planner's call: it's derived from
  data and needs no stored marker. Reversible.
- The replacement keeps the original's role, and takes rest from its own last snapshot. Planner's call:
  these are slot and timer values only, no plan values. Reversible.
- The labels "Skip exercise" / "Replace exercise" are Planner's call: "Swap" is not a DESIGN §4 verb, and
  "Replace" says what happens.
- A mis-picked replacement can't be removed. Accepted for v1 (Planner, flagged 2026-09-23).
- Picker route, marker field name, control placement: implementation (CC), within DESIGN §4.
