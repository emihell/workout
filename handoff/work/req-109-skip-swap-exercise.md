# req-109 — skip a whole exercise, or swap it for another, mid-workout (batch 4, F2+F8)

**Status: SPEC — READY, held for Emilio's go.** Phase 1. **[ux-feel]** Persisted-adjacent (writes the
transient `activeWorkout` — its `snapshot.items` and `sets`; **no schema-version bump**).

From Emilio's in-app notes (2026-09-18, `/workout/sess-push-pull`):
- F2: *"If i can't do a machine i should be able to add another exercixe"*
- F8: *"Add ability to skip whole exercise?"*

On swap (2026-09-23): *"replacement should only be for this one time only, replacement are only done when
the machine you want is taken, usually during warmup … as the warm up can be anything, it should be a
blank state - copying form the existing wamrup is guessing they are similar"*. Blank state as below:
agreed ("sounds good").

## Why

[measured] Only per-set Skip exists (`skipSet`, `src/views/workout/item.jsx`). A workout's items are a
snapshot fixed at Start; nothing adds or replaces one. At finish, `withSkippedUnloggedSets`
(`src/workout-log.js:75`) already records unlogged sets as skipped, using the `skippedSet` record (`:56`).

## The behaviour

**Skip exercise:** on an exercise's log screen. Logs every remaining (unlogged) set of that exercise as
skipped (the same record `skippedSet` builds), marks it done, and returns to the overview. Sets already
logged stay. On the overview the row reads as **skipped**, not "done".

**Swap exercise:** on an exercise's log screen. Pick an exercise from the library, then:
1. The original is treated as **Skip exercise** (above).
2. The picked exercise is inserted **directly after** it in this workout, in a **blank state**:
   **1 working set, no reps target, no suggested weight, no warm-up set**. Rest = that exercise's own rest
   setting, else none. Role = the original's (it fills the same slot, e.g. still reads as warm-up).
3. Prefill follows the normal rule: the picked exercise's **own** finished history if it has any, else
   empty (DESIGN §1). **Nothing is copied from the original exercise** — not its sets, reps, weights or
   warm-up.
4. More sets through the existing **Add set** on its done view.
5. **This workout only.** The routine template is never changed, at swap or at finish.

## Scope

`src/views/workout/item.jsx`, `overview.jsx`, a picker screen (route: CC's), `src/workout-log.js` (pure
skip/insert helpers + tests), the store's active-workout path.

## Out of scope

Adding an extra exercise without replacing one; reordering; swapping an already-done exercise (re-open it
first); creating a new exercise from the picker.

## Order vs siblings

Last of batch 4 on both files: after req-104/106/108 (`item.jsx`) and req-105/107 (`overview.jsx`).

## Watch-outs (CC)

- **Routine template safety:** the swapped-in item needs a **new unique item id**, never the original's
  and never one in the routine template. `applyProgressionToRoutines` (`src/model.js:295`) matches by
  `routineItemId`, so a reused id would write the new exercise's weights onto the original's template.
  Its absence from the routine must be a no-op.
- **Same exercise twice:** a swap to an exercise already in this workout. `model.js` keys some snapshot
  rebuilding by `exerciseId` (`itemByExercise`, ~line 185). Confirm history detail / edit still show both
  items' sets correctly, or report what breaks.
- The blank item must work in every consumer that reads `targets` / `suggestedWeights` / `warmup`: the
  log form, req-106 preview, beat-last-time, Finish, history.

## Acceptance criteria

- **Skip (browser):** in a 3-set exercise with 1 set logged, tap Skip exercise → back on the overview,
  row reads skipped; after Finish, history shows 1 logged + 2 skipped sets.
- **Swap (browser):** swap an exercise → the original reads skipped and the picked exercise sits directly
  under it with 1 set, no target, no kg.
- **Failure case — no copying (unit):** swap an exercise with targets 10/8/6 and weights 40/45/50 to one
  with no history → the new item has no targets, no weights and no warm-up.
- **Right mechanism — own history (unit):** swap to an exercise with finished history → its set-1 seed
  equals `initialSetFields` from that exercise's history, not from the original's.
- **Template untouched (unit):** finish a workout with a swap → the routine's exercises (ids, targets,
  weights) equal what they'd be without the swapped-in item.
- **Auto-complete:** a skipped item counts as done for the req-84 all-done test.
- **No regression:** `./check` green; no `STORAGE_KEY` / schema-version change.

## Decisions

- Skip exercise = remaining sets logged skipped (Emilio, 2026-09-23).
- Swap = original skipped + blank replacement, own history only, this workout only (Emilio, 2026-09-23).
- Replacement keeps the original's **role**; rest from its own setting (Planner — label/slot only, no
  plan values; reversible).
- Where the two controls sit on the log screen, and the picker route — implementation (CC), within
  DESIGN §4 placement.
