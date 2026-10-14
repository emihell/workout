**Status: BUILT AND MERGED, 2026-10-14 — branch `req-222` (`c8a3316`…`c8a3316`, 1 commit).** **Lane: ui** — display only; writes nothing. Touches `workout-log.js` → independent reviewer (DEC-057).

# req-222 — the GO pill shows from the start and counts the whole workout

DEC-125 §3 (Emilio, batch 6 I3: "When i open a exercise the first time, should i not get the go?"; I9: "Would be nice to see how much
i have left in whole workout - maybe in the go chip?"). Builder: throwaway agent (DEC-055). Build after req-221, before req-223.

## Facts (rescanned 2026-10-14, `main` 73cdf1e)

- Pill: `WorkoutPill` (`ui/index.jsx:389-415`), wrapper `views/workout/rest.jsx:20-38` (null without an active workout or a pill
  state). Rendered on overview `:185`, finish `:62`, replace `:56`, add `:26`, setup `:50`, log `item.jsx:528`, review `item.jsx:776`.
- State: `workoutPillState` (`workout-log.js:1111-1131`): `lead = resting ? clock : 'GO'`, tail `set N/M` only once that item has a
  non-skipped set (`:1116`). `currentWorkoutItem` returns **null before any non-skipped set** (`:1067`) and when all items are
  done (`:1080`) → no pill at the start of a workout.
- Exercise list = `workout.snapshot.items`. Swap = `replaceItemPatch` (`:304-313`): the original is **skipped** (`skipItemPatch`) and
  the replacement inserted after it. Add exercise appends (`appendItemPatch`, `:318`). Done = `itemIsMarkedDone || plannedDone`
  (`:344-358`); skipped items count as done.
- Tap: opens the current item's log, or skips rest on its own log screen (`rest.jsx:29-36`) — DEC-103 §3.
- Tests on the pill: `req-186.test.js:174-180`, `req-203.test.js:120-131`, `req-188.test.js`.

## Scope

1. **Pill from the start.** With an active workout and no logged set, the pill shows **GO** and its current item is the first
   not-done item in list order. Tap opens it (as today). After the first set, today's "current item" rule is unchanged.
2. **Whole-workout count.** The pill adds the workout position: **"GO · set 2/4 · 3/7"**, resting **"1:12 · set 2/4 · 3/7"**,
   before any set of the current item **"GO · 3/7"**.
   - **M** = items in the snapshot, **minus** originals that were swapped away (their replacement counts instead).
   - **N** = done items (skipped included) + 1, capped at M. So it reads "how far along", not the row's position.
3. All done → pill hidden (as today, `:1080`).

## Out of scope

The preview / not-started overview (no pill, unchanged); the review screen's layout; the Up next bar (req-223); any stored field.

## Acceptance criteria

1. Unit (`workoutPillState`): fresh workout of 7 items, no sets → `{ lead: 'GO', item: items[0] }`, text "GO · 3/7"-shaped with N=1.
2. Unit: 2 items done, 3rd has 1 of 4 work sets → "GO · set 2/4 · 3/7"; resting → clock lead, same tail.
3. Unit: item 2 swapped (original skipped + replacement inserted) → M stays 7, not 8.
4. Unit: items done out of order (5 and 6 done, rest not) → N = 3, current = item 1.
5. **Failure case — empty input:** a workout with 0 items → no pill (null), no crash; all items done → null.
6. **Is the right mechanism answering?** Criterion 3 asserts M from a snapshot built by `replaceItemPatch` itself, not a hand-made one.
7. Rendered: overview of a just-started workout shows the pill; tapping it opens item 1's log screen.
8. Browser (`plan qa`): start Upper body, pill visible on the first screen, reads "GO · 1/7"; log, skip, swap → numbers move as above.
9. `./check` green.

## Decisions made on Emilio's behalf

- **behaviour** `(unconfirmed)`: format "set 2/4 · 3/7" — the exercise count appended after the set count, no "exercise" word.
- **behaviour** `(unconfirmed)`: N counts done items, not the list position; a swapped-away exercise doesn't count.
- implementation: derive M/N in `workout-log.js` from the snapshot; no new field. If the swapped-away original can't be told apart
  from a plain skip without a new field, **stop and report** — don't add one (it would be an `activeWorkout` field: `migrateState` →
  `workoutSnapshot`, WORKFLOW READY check 5).

## READY checks

1. DECs: DEC-103 §3 (one pill, tap opens current exercise), DEC-108 §3 (skip rest via pill), DEC-125 §3.
2. Siblings: req-223 lands Start on the first exercise (build after this); req-221 unrelated. 3. none.
4. Numbers: from `workout-log.js` reads above. 5. `workout-log.js` → reviewer; no stored write → no backup reminder. 6. marked.
