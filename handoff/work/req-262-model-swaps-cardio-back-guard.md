**Status: BUILT, NOT merged — branch `req-262` (`756a8e5`…`d1f1772`)** · **Lane: bug** · DEC-125 §5, DEC-126, DEC-058 §2, req-116, req-224. Fix batch (DEC-155): **after req-261** (both touch
`src/workout-log.js`). Touches `model.js`, `workout-log.js`, `store.jsx` → reviewer **and** backup reminder (WORKFLOW check 5; part 1 writes stored swaps).

# req-262 — four small model fixes: stale swaps, cardio Apply, Back after a left-open Finish, key-less items

Review findings (req-225, req-107, req-224, req-176), re-checked against `main` `4c1121b` on 2026-10-31.

## Reproduction [measured, `main` `4c1121b`, 2026-10-31]

**1. Past one-date swaps are never pruned.** `normaliseSwaps` (`src/model.js:318-338`) keeps any well-formed swap, any date;
`slotSwappedOnDateState` (`src/state-reducers.js:331-341`) only replaces the one (slot, date) it writes:

```
normaliseSwaps keeps 2020: [{"id":"w1","slotId":"s1","date":"2020-01-06","routineId":"B"}]
after a new swap: 2020-01-06,2026-11-02
```

(`node -e` against `model.js` + `state-reducers.js`; slots `[{id:'s1',routineId:'A'}]`, routines A, B.) `schedule.swaps` grows
by one per "Swap for today", forever. Swaps are read by `slotsOn` (`src/schedule.js:91-104`) for any date; the readers that
look at dates before today look only inside the current Mon–Sun week (`doneEarlier`, `schedule.js:231-250`) [measured:
`grep -rn "slotsOn\|swapOn" src`]; no screen pages back to an earlier week [inferred: no week-paging code found in `src/views`].

**2. Apply on a cardio item writes kg `[0]` and targets `[""]`.** `progressionForItem` (`model.js:452-479`) returns
`to: recommendation.weights` once a set is logged; `applyProgressionToRoutines` (`model.js:416-436`) writes it:

```
to: [0] targetsTo: [""]
routine item after Apply: {"id":"i1","exerciseId":"row","sets":1,"targets":[""],"suggestedWeights":[0]}
```

(a Rowing item, `type: 'cardio'`, `targets: []`, `suggestedWeights: []`, one logged set `durationSec: 600`.) Not shown
anywhere today [inferred]; it is data the user never entered (CLAUDE.md: the app never invents data).

**3. Back after a left-open Finish offers Start again.** `finishedForPlan`'s ad hoc fallback (`src/current-workout.js:51-67`)
covers a workout only if `finishedAt` is within 6 h of now; a left-open Finish saves `finishedAt` = the last set's time
(`finishTimeFor`, `workout-log.js:198-203`, `LEFT_OPEN_MS` 3 h):

```
finish time: {"finishedAt":"2026-10-26T17:00:00.000Z","leftOpen":true}
ad hoc preview guard Tue 07:00: null
same, saved within 6h of last set: true
```

So Back from that Save lands on `/workout/R` (caller `views/workout/overview.jsx:88`) and offers Start — req-116's bug, back.

**4. Two items with no key share their skips.** `itemKey` → `''` (`workout-log.js:12-14`); `setsForItem` (`:16-23`) matches
`set.routineItemId === ''` and `undefined === undefined` for every key-less item. Producer: `migrateState` → `workoutSnapshot`
(`model.js:88-147`) keeps a stored/imported snapshot item that has neither key when its routine is gone (`:136`):

```
keys after migrateState: [[null,null],[null,null]]
skip records written: 3 keys: ["","",""]
setsForItem(Y): ex-x,ex-x,ex-x
```

(X with 3 sets, Y with 2; `withSkippedUnloggedSets` writes 3 skips, not 5, and Y "owns" X's.) No in-app builder makes such an
item (`buildPlannedWorkout` keys `pi-${id}`, `model.js:514-515`); only old or hand-made imports.

## Scope

1. **Prune on write:** `slotSwappedOnDateState` takes `today` (a date key, passed by `store.jsx`'s `swapSlotOnDate`) and
   drops every swap dated **before the Monday of today's week**, then applies the new one as now. `normaliseSwaps` and the
   load path are not changed (no clock in `migrateState`).
2. **Cardio Apply keeps the item's own plan:** in `progressionForItem`, an item whose exercise type is `cardio` returns the
   item's own `suggestedWeights` / `targets` as `to` / `targetsTo` (as it does today with no logged sets).
3. **Back guard:** the store keeps, in memory only (never persisted, never synced), the id of the workout this tab last
   finished; `finishedForPlan` takes it as an option and, for the ad hoc plan of the same routine, treats that workout as
   covering within 6 h of when it was saved. No new stored field.
4. **Key-less items:** in `setsForItem`, compare by key only when the key is non-empty and `item.id` only when defined; a
   key-less item then matches by `exerciseId` alone (the existing legacy rule, `:21`). No stored data rewritten.

## Out of scope

- **A swap whose slot's own routine is archived has no "Back to"** (`views/Today.jsx:188,254`): not a defect — the own
  routine can't be restored by a swap, and Swap is still offered. Dropped.
- Rewriting stored `[0]` / `[""]` already written by part 2 (a bulk write → data lane; count first if ever wanted).
- Two key-less items of the **same** exercise (they still share, as legacy sets always have).
- A `savedAt` field on workouts (rejected for part 3: a schema change for a rare path).

## Steps

1. Tests first, each failing on `main` (AC1–AC4).
2. Parts 1–4. Part 3: `finishWorkout` in `store.jsx` records the id in a ref/state that never reaches `storage.js`/sync.
3. `./check`; browser run on `./plan qa` (AC5).

## Acceptance criteria

1. **Swaps:** a state with swaps dated 2020-01-06, last week's Sunday, this week's Monday and today → after one new swap,
   the 2020 and last-Sunday entries are gone, this Monday's and today's kept. Failure case: `today` absent → nothing pruned
   (fails closed, same state as today's code). This week's `doneEarlier` result is unchanged (assert on one fixture).
2. **Cardio:** the repro 2 item → after Apply `suggestedWeights: []`, `targets: []`. A strength item's Apply is
   byte-identical to `main` (same fixture, both receipts). Right mechanism: the cardio test fails on `main`.
3. **Back guard:** the repro 3 workout, finished in this tab → `finishedForPlan` returns it for `/workout/R` at Tue 07:00.
   Failure case: the same workout **not** finished in this tab (a reload, another device) → `null`, exactly as `main`.
   `JSON.stringify` of the persisted state contains no new key (assert against `storage.js`'s save input).
4. **Key-less:** the repro 4 state → 5 skip records; `setsForItem(Y)` returns only Y's 2. Every existing test green
   (`setsForItem` has many callers: the reviewer checks each).
5. **Browser, `./plan qa`:** Swap for today twice on different days, export the state → only this week's swaps; a cardio
   item's routine after History → Recalculate → Apply shows no kg. Receipts: the stored values.
6. `./check` green; smoke green.

## Checks run

1. DECs grepped (swap, Back after Finish, cardio kg, routineItemId): DEC-125 §5 / DEC-126 (swaps: one date, moves carry them,
   what a screen says is what you get — pruning past weeks changes no screen); DEC-058 §2 (the 6 h window); none governs
   pruning, cardio Apply, or key-less items.
2. Siblings: **req-261 first** (`workout-log.js`, `workoutPosition`); req-263 (History Back chain) — no shared file.
   `exchange.js:757` filters swaps on import by slot/routine only; untouched.
3. Deferrals: existing `[0]` / `[""]` records stay (Out of scope); re-price if a screen ever shows routine kg for cardio.
4. Numbers: the repro commands above, 2026-10-31. Emilio's own swap count was not read (no DB on this machine).
5. Triggers: `model.js`, `workout-log.js`, `store.jsx` → independent reviewer; part 1 writes stored swaps → **backup
   reminder** before merge (DEC-046). No snapshot field added; `migrateState` → `workoutSnapshot` untouched.
6. `(unconfirmed)`: none — each part restores a decided behaviour or removes invented data; nothing new on screen.

## Decisions made on Emilio's behalf

- **implementation:** prune at write time, not on load; the week boundary (this week's Monday) because `doneEarlier` reads
  this week's earlier days; an in-memory "finished here" id over a stored `savedAt`; the key-less fix in `setsForItem`, not
  by writing ids into stored snapshots.
- **dropped:** the archived-own-routine "Back to" (Out of scope, reason above).
