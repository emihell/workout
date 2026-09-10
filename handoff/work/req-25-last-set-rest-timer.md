# req-25 — bug: the last set of an exercise starts no rest timer

**Status: BUILT AND MERGED, 2026-09-10 — branch `req-25` (`59dfff9`…`59dfff9`, 1 commit).** Fixes gym-flow bug #5 (Emilio's 2026-09-10 notes, `work/BACKLOG.md`). The
behaviour call below is **decided** (Emilio, 2026-09-10).

**Gate: functional bug-fix, but gym-flow feel** (DEC-009) — planning verifies the timer now runs
(in-browser + a unit test); **present to Emilio to feel before merge** (it changes the in-gym flow).

## Why — reproduced, not recalled

Emilio: *"If i go previous after a set and then forward — no timer. Or if timer has been run, it will
not run again for that set."* Reproduced live (Upper Body → Chest Press, restSec 90, WU + 3 work
sets, on real data, then Abandoned):

- **[measured] Every set EXCEPT the last rests correctly**, including the Previous→forward path:
  completed the WU set and work sets 1–2 → rest bar armed at 88s and **ticked down** (88→74s); went
  Previous during rest, then Complete → rest **re-armed and ticked**. The general "previous then
  forward" case is **not** broken in current code.
- **[measured] The LAST set gives no rest.** Completing work set 3 of 3 jumped straight to the
  exercise-list overview with **no rest bar**. Re-opening and re-completing that last set → still no
  rest. This is the reproducible defect, and it matches both of Emilio's symptoms (the final set of
  an exercise is the one with "no timer", and re-doing it never rests).

**Root cause** [measured] (`src/views/workout/item.jsx`):

```js
function finishAfterThisSet() { if (needsWu) return false; return currentWorkIndex + 1 >= workCount }
function restAfterSet(done, skipped = false) {
  if (done || skipped) return { restEndsAt: null, restPausedRemaining: null }   // ← `done` suppresses rest
  if (item.restSec > 0) return { restEndsAt: Date.now() + item.restSec * 1000, restPausedRemaining: null }
  return { restPausedRemaining: null }
}
function completeSet(...) { const done = finishAfterThisSet(); store.completeSet(rec, restAfterSet(done)); if (done) markDoneAndGoToOverview(...) }
```

`done` (last set) makes `restAfterSet` return **no rest**, and `completeSet` then navigates to the
overview (req-11 / DEC-013). So the rest after the final — usually hardest — set never runs.

## The decision (Emilio, 2026-09-10)

**Rest on the overview.** Completing the last set **arms the rest** and still drops to the exercise
list; the **persistent RestBar shows the countdown there** while the user picks their next exercise.
Chosen over "stay on the exercise until rest ends". This refines DEC-013 (last set → done → overview)
by adding a running rest to that transition — **flag it as a DEC-013 update.**

This fits the architecture: [measured] `overview.jsx` already renders `<RestBar />` (line 99), and the
RestBar is the persistent, self-hiding rest UI (req-03/DEC-003). So arming rest on the last set makes
it appear on the overview automatically.

## The change

1. Rest is armed by **completion**, not suppressed by "is this the last set". Change the guard so
   `done` no longer suppresses rest — only `skipped` does. The natural shape is to make the rest
   patch depend only on `{restSec, skipped}`:
   - a completed set with `restSec > 0` → `restEndsAt = now + restSec*1000` (whether or not it's the
     last set);
   - a **skipped** set → no rest (unchanged);
   - `restSec === 0` → no rest (unchanged).
2. `completeSet` still computes `done` and still calls `markDoneAndGoToOverview` when `done` — the
   **navigation is unchanged**; only the rest patch changes. The rest patch and the mark-done patch
   both apply to `activeWorkout`; verify the mark-done path preserves `restEndsAt` (see domino check).
3. **Make it testable (DESIGN rule).** Extract the rest-patch decision into a pure function in
   `workout-log.js` (e.g. `restPatchAfterSet({ restSec, skipped })` → `{ restEndsAt, restPausedRemaining }`)
   and unit-test it, so the "when does rest run" rule is inspectable outside the component. `restAfterSet`
   in the view then delegates to it.

## Domino check (shared state — do before claiming done)

`completeSet` applies `restAfterSet(done)` via `store.completeSet(rec, patch)`, then
`markDoneAndGoToOverview` applies `markItemDonePatch(...)` via `store.patchActive`. **Assert
`markItemDonePatch` does not clear or overwrite `restEndsAt`/`restPausedRemaining`** — if it does, the
newly-armed rest would be wiped before the overview renders. Name what you checked in the report.

## Scope

- The rest-patch guard (drop `done` from the suppression) + the pure `restPatchAfterSet` extraction
  and its test.
- Nothing else: navigation on the last set, the mark-done behaviour, the skip behaviour, and every
  non-last set stay exactly as today.

## Out of scope

- The rest-end cue (sound/vibration) — separate backlog item.
- The "upcoming weight during rest" note (#1), "remove info under buttons" (#2), etc. — separate reqs.
- Any change to `restSec` values or where they're set.

## Acceptance criteria (written before implementation)

- **Unit test (pure fn):** `restPatchAfterSet({restSec:90, skipped:false})` → a future `restEndsAt`;
  `{restSec:90, skipped:true}` → null rest; `{restSec:0, skipped:false}` → null rest. Paste output.
- **The bug is fixed (Emilio/planning, in-browser):** complete the **last** work set of an exercise
  with `restSec > 0` → the app goes to the exercise list **and the rest bar is running there** and
  ticks down. (Repro path: Upper Body → Chest Press, restSec 90.)
- **No over-fix:** completing the last set of an exercise with `restSec === 0` → no rest (unchanged);
  **skipping** the last set → no rest; every non-last set behaves exactly as before.
- **Navigation unchanged:** completing the last set still marks the exercise done and returns to the
  overview (DEC-013 preserved) — now with a rest running.
- **Domino:** the report states that `markItemDonePatch` preserves `restEndsAt` (or, if it didn't, how
  it was fixed).
- **No regression:** `./check` green (paste the line).

## Decisions

- **behaviour:** decided above (rest-on-overview). Refines DEC-013 — record the update.
- **implementation (CC's call, note in report):** the pure fn's exact name/signature; where it lives
  in `workout-log.js`; whether `done` is still passed to `restAfterSet` at all once it's inert for rest.

## Notes

Diagnosis by browser repro (the general previous→forward path was verified *working*; the confirmed
defect is the last set only). If Emilio has also seen "no timer" on a **non-last** set, that's a
separate, not-yet-reproduced issue — say so and investigate rather than assuming this fix covers it.
