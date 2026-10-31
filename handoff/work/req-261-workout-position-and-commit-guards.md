**Status: READY** · **Lane: bug** · DEC-155 §2 (Ex N), DEC-125 §3, DEC-104/107, DEC-102 §2. Fix batch (DEC-155): before req-262
(both touch `src/workout-log.js`). Touches `workout-log.js` → reviewer (WORKFLOW check 5); no stored records rewritten → no backup reminder.

# req-261 — "Ex N" is the open exercise; one tap on Add commits once; Sets has a ceiling

Three review findings (req-222/244, req-188), re-checked against `main` `4c1121b` on 2026-10-31.

## Reproduction [measured, `main` `4c1121b`, 2026-10-31]

**A. "Ex N of M" counts done items, not the exercise you're on.** `workoutPosition` (`src/workout-log.js:1190-1196`):
`current: Math.min(counted.length, doneCount + 1)`. 9 items, one set logged on item 2:

```
node -e "import('./src/workout-log.js').then(m=>{const item=(id)=>({routineItemId:id,exerciseId:'ex-'+id,sets:3,targets:['8','8','8']});
const w={routineId:'r',snapshot:{items:[1,2,3,4,5,6,7,8,9].map(i=>item('i'+i))},sets:[{routineItemId:'i2',exerciseId:'ex-i2',setType:'work',weight:20,reps:'8'}],completedItemIds:[]};
console.log(m.workoutPillState(w,0).label, m.workoutPillState(w,0).item.routineItemId, JSON.stringify(m.workoutPosition(w)))})"
GO · set 2/3 · 1/9 i2 {"current":1,"total":9,"done":0}
```

The pill is on i2 but says 1/9; `UIWorkoutPill` words it "Ex 1 of 9" (`src/views/workout/rest.jsx:42`). Callers of
`workoutPosition`: `workoutPillState` (`workout-log.js:1160`, `countText`) and `rest.jsx:42`; tests `req-222.test.js`, `req-227.test.js`.

**B. A double tap on "Add N" commits twice.** `ExercisePicker`'s `add` (`src/views/ExercisePicker.jsx:176-197`, button `:292`)
has no in-flight guard; neither has `MidWorkoutPicker`'s `commit` / `save` (`src/views/workout/mid-workout-picker.jsx:26-35`, `:58-62`).
Rendered repro (happy-dom, real store, the req-191 AC7 harness; scratch file, not in the repo): tick one row, then two
`click()`s on the button inside one `act`:

```
# button: Add 1
# onAdd calls after two taps: 2
```

A second `onAdd` adds the routine items twice and, for a library pick, runs `store.addExercise` twice (two records). On the
workout side the same `add` → `onPick` → `commit` → `store.addWorkoutItems` (`views/workout/add.jsx:31-35`) twice. [inferred
for the mid-workout path from the code; the routine path is the run above]

**C. Sets has no upper bound.** Both parsers accept any positive whole number:

```
node -e "import('./src/mid-workout-pick.js').then(m=>console.log(m.noHistoryItem({sets:'99999'}).item.sets))"
99999
node -e "import('./src/routine-item-parse.js').then(m=>{const r=m.parseRoutineItem({sets:'99999',reps:'',kg:''});console.log(JSON.stringify(r.errors), r.value.sets)})"
{} 99999
```

(`src/mid-workout-pick.js:35`, `src/routine-item-parse.js:88-92`.) `plan build` C4 also only checks `≥ 1` (`server/plan-build.mjs:109`).

**D. Dead code:** `activeSetPatch` (`src/views/set-values.js:119-124`) has no production caller (`grep -rn activeSetPatch src`
→ only `set-values.js` and `req-154/155/156/194.test.js`); `WorkoutSetEdit` only redirects since req-212 (`req-154.test.js:90-97`).

## Scope

1. **N = the exercise the pill is on** (DEC-155 §2): in `workoutPosition`, N is the 1-based place, among the counted items,
   of the item `workoutPillState` shows (`currentWorkoutItem(workout)`, else the first not-done item — the same pick as
   `workout-log.js:1152`). Nothing open (all done) → keep `min(M, done + 1)`. `done` stays in the return value. M unchanged.
   Both callers follow automatically; no view change.
2. **One commit per tap:** a `useRef` flag set on the first call in `ExercisePicker`'s `add` and `MidWorkoutPicker`'s `commit`;
   a second call while it's set does nothing. The step's `save` with errors doesn't set it (the user fixes and taps again).
3. **A ceiling on Sets: `MAX_SETS = 20`** (confirmed DEC-155 §4), one exported constant used by `noHistoryItem` and `parseRoutineItem`.
   Above it → the field's inline error, same style as today: "Sets must be a whole number from 1 to 20." `plan build` C4
   refuses above it too, with that number in the message.
4. **Delete `activeSetPatch`** and the assertions that only test it (`req-154.test.js:75-92` site 2, keeping its `:93`
   "writes nothing" test; `req-155.test.js:29,36`; `req-156.test.js:88,92,146-148`; `req-194.test.js:145`), keeping the rest of each test.
   Fix the `set-values.js:1-9` header, which still names "active set edit". Test removals called out in the report.

## Out of scope

- **Blank kg on the live Previous → Save writes 0** while History keeps `''` (`set-values.js:20-25` `liveSetWeight`, `:40`).
  Not a bug: the live log's Complete writes 0 for a blank kg too, and the split is recorded — req-154 kept each site's "as
  before" (`set-values.js:4-6`), DEC-102 §2 kept Complete's "No weight entered" note. Changing what a blank kg stores is a
  behaviour call → BACKLOG (Planner), not this req.
- **A pre-req-188 swap counted twice** (re-check item 9): it needs an *active* workout started before req-188 with a
  swap in it; none can exist now. Dropped.
- The "Ex"/"Exercise" wording and the pill layout (req-244, BACKLOG).
- A double tap anywhere other than the two pickers.

## Steps

1. Tests first (they must fail on `main`): position (AC1, AC2), the double tap (AC3), the ceiling (AC4).
2. `workoutPosition` (scope 1). Update `req-222.test.js:82-88` ("AC4 — N counts done items, not the row position": items 5
   and 6 done, pill on i1 → today `3/7`; now `1/7`) — a test edit by DEC-155 §2, called out in the report.
3. The two guards (scope 2), the ceiling (scope 3), the dead code (scope 4).
4. `./check`; browser run on `./plan qa`.

## Acceptance criteria

1. **Fails on main, passes on the branch:** the repro A workout → `workoutPosition` = `{ current: 2, total: 9, done: 0 }`,
   the pill `GO · set 2/3 · 2/9`. Both receipts.
2. **Right mechanism, not a coincidence:** a workout where done + 1 and the open row's place differ in the other
   direction — items 1–3 done, a set logged on item 7 → N = 7 (done + 1 would be 4). All items done → the pill is `null`
   as before, and `workoutPosition` returns `current = M`. A swap (req-222 AC3) and a reopened swapped-away item
   (`req-227.test.js:46-63`) still give `current ≤ total`.
3. **Failure case — double tap:** a rendered test ticks one library row and clicks "Add 1" twice before React re-renders →
   `onAdd` called once, `store.exercises` grows by one. Same for the mid-workout step's Save. Fails on `main` (2 calls).
4. **Failure case — ceiling:** `noHistoryItem({ sets: '21' })` → `errors.sets`; `'20'` → 20 sets; `parseRoutineItem` the
   same; `plan build` with `sets: 21` → refused. Unchanged: `'0'`, `''`, `'2.5'` errors as today.
5. `grep -rn activeSetPatch src` → nothing; `./check` green; the smoke test green.
6. **Browser, `./plan qa`:** start a workout, log a set on exercise 2 → the pill reads "Ex 2 of N"; the Add exercise screen
   with a fast double tap adds one exercise. One screenshot or stored-value receipt each.

## Checks run

1. DECs grepped (position, pill, double, sets bound, blank kg, activeSetPatch): DEC-125 §3 (the pill counts the workout; no
   rule for N), DEC-155 §2 (N = open row, decided), DEC-104/107 (the step's fields), DEC-102 §2 (blank kg note). None sets a
   Sets maximum.
2. Siblings: **req-262** (after this; also `workout-log.js`, a different function — `setsForItem`). req-264 (if specced as
   the routine-editor batch: change-exercise reset, Days row) touches `Routine.jsx` / `routine-item-change.js`, not
   `routine-item-parse.js` — either order, a rebase at most. req-256 (progress.js) — no overlap.
3. Deferrals: the blank-kg split stays as recorded (Out of scope).
4. Numbers: from the commands above. `MAX_SETS = 20` is a Planner pick with no measured source (unconfirmed below).
5. Trigger: `workout-log.js` → independent reviewer. No migration, no stored record rewritten → no backup reminder.
6. (confirmed DEC-155 §4): the ceiling value and its message.

## Decisions made on Emilio's behalf

- **behaviour (confirmed DEC-155 §4):** Sets ceiling **20**, error text "Sets must be a whole number from 1 to 20." Builder: report
  the largest `sets` in `src/db.json`; Emilio's live data was not read (no DB on this machine).
- **implementation:** N from the pill's own item pick (one rule for pill and words); a `useRef` guard rather than a
  disabled-after-click state; one `MAX_SETS` shared by app and `plan build`; `activeSetPatch` deleted, not kept for tests.
