**Status: BUILT, NOT merged — branch `req-241` (`7967a98`)** · **Lane: ui** · batch 7 (J4, J7). No stored-data shape change.

# req-241 — the log screen names what's next; a done set can be turned into a skip

Emilio, 2026-10-19: "Would be nice to see what's next as well" (log screen); "Should be able to press skip if i acidenttally
chose done" (review). No E decision against (PAGES.md: DEC-119 §1 defines Done/sheet/Save; DEC-125 §2 the arrival bar)
→ Planner's fix (DEC-137).

## Code facts (rescanned 2026-10-26, `main` 103678a)

- Next exercise: `nextNotDoneItem(workout, item)` (`workout-log.js:873-882`, wraps, skips done). Shown today only in the
  arrival bar (`item.jsx:258-259`, `showUpNext` `:301-306`) and the review's "Next: {name}" (`:905-906`).
- A done set's sheet: `LoggedSetSheet` (`item.jsx:770-825`) → `SetEditSheet` with fields + Save; `skipped` prop already lets a
  skipped set be filled in and saved (un-skip).
- A skip record: `weight: 0, reps: 'skipped', note: 'skipped', rpe: null` (`item.jsx:451-454`); `isSkippedSet` reads
  `reps === 'skipped'` (`set-rules.js:16-18`). Save path: `viewedSetSave` → `store.updateActiveSet` + seed-override rerun
  (`item.jsx:787-803`).

## Scope

1. **Next line:** on the log screen, under the set list, a quiet line **"Next: {exercise name}"** from `nextNotDoneItem`.
   Hidden while the Up next bar shows, and when there is no next exercise.
2. **Skip set in the done-set sheet:** when the opened set is not skipped, the sheet has **"Skip set"**. It rewrites that set
   as a skip record (fields above, `loggedAt` kept) through the same save path, so seed overrides re-run as on Save
   (a skipped set carries no kg, DEC-052). Opening it again shows the existing skipped state (fill in + Save un-skips).
3. Works in both places the sheet opens: the log screen's set list and the review.

## Out of scope

- History's set edit (`views/set-edit.jsx`); the routine-kg offer (it ran at the exercise's end and is not re-asked).

## Acceptance criteria

1. Exercise 2 of 4 open, sets logged → "Next: {exercise 3}" shows; on the last not-done exercise → no line.
2. Arriving from Start (bar showing) → no Next line until the bar goes.
3. Review → tap a done set → Skip set → that row reads "· skipped"; stored set has `reps: 'skipped'`, `loggedAt` unchanged.
4. **Failure / right mechanism:** set 1 logged at 40 kg (changed from routine 30) then skipped → set 2's prefill is the
   routine's 30 kg, not 40 (the carry re-ran; assert the seed source).
5. A skipped set's sheet shows no "Skip set".
6. `./check` green.

## Decisions made on Emilio's behalf

- Line wording/placement "Next: {name}" under the set list, hidden during the bar `(unconfirmed)` — behaviour.
- Skip from the sheet asks no confirm (reversible by filling it back in) `(unconfirmed)` — behaviour.

## READY checks

1 DECs: DEC-052, DEC-119 §1, DEC-125 §2. 2 Siblings: req-239/240 touch `item.jsx` (order 239 → 240 → 241). 3 None.
4 None. 5 Trigger files: if the skip patch lands in `workout-log.js` or `store.jsx` → **independent reviewer**; it writes
one set through the normal path → no backup reminder. 6 Marked.
