# req-83 — a set value changed mid-workout becomes the future default (N9)

Branch: `req-83`. Status: **READY** (planning session to merge; live in-gym click-through is an Emilio item — Chrome extension not connectable from this session).

## Technical

**Behaviour.** When the user enters a value on a set's log form that differs from the seed
the form presented, that value becomes the seed for the **remaining sets of the same
exercise this session**, until changed again. Only the field actually changed propagates.
Live/session only — it never writes the routine template and never touches history-prefill
(finished-workouts only, unchanged).

**Mechanism — a session-scoped override map on `activeWorkout`.** Chosen over "seed from the
last logged set" because the latter can't tell *"user changed it"* from *"user accepted the
seed"*: with descending per-set rep targets, re-logging an unchanged target would wrongly
override the next set's own target. The override compares each logged field against the seed
the form **presented**, so only a genuine change is captured. This is broader than the removed
req-27 `nextSetWeight` (all remaining sets, not one; live, not tied to the gone rest panel).

**Shape.** `activeWorkout.seedOverrides` = `{ "<exerciseId>::<wu|work>": { weight?, reps? } }`.
Keyed by exercise **and** set kind, so warm-up and working sets seed independently and a change
can never cross exercises. Optional/transient — **no schema-version bump**; `startWorkout`
seeds `{}`, `finishWorkout` strips it so it never lands on finished history, and it clears with
`activeWorkout → null` at finish.

**Files**
- `workout-log.js` — pure core:
  - `setLogSeed`/`initialSetFields` gain an `override` param, applied per-field **below**
    restore (Previous still wins) and **above** carry/history/target; `weighted` still gates
    kg. With no override, output is byte-identical to before (locked by the existing parity test).
  - `seedOverrideKey(exerciseId, setType)` — `wu` vs `work`.
  - `nextSeedOverrides(overrides, {exerciseId, setType, weighted, seed, logged})` — returns the
    next map; records a field only when the logged value differs from the presented seed
    (weight compared numerically, reps as trimmed strings); returns the **same map by identity**
    when nothing changed.
- `views/workout/item.jsx` — reads the override for the current exercise+setType into the seed;
  on `completeSet`, computes `nextSeedOverrides` and merges it into the same `activeWorkout`
  patch as the rest timer. `skipSet` deliberately does **not** touch overrides (a skip is not a
  value change).
- `store.jsx` — `startWorkout` inits `seedOverrides: {}`; `finishWorkout` destructures it off
  the finished record.

**Guard rails — how each is enforced (not just claimed)**
- *No-invent (DESIGN §1):* a field is written to the override only when `logged !== presentedSeed`;
  an untouched field falls straight through to the normal per-set seed. Tested.
- *Field isolation:* change only weight → no reps override → next set's reps use their own target.
  Tested both directions.
- *No cross-exercise leak:* the map is keyed by `exerciseId`; `nextSeedOverrides` only ever
  writes the current exercise's key. Tested.
- *History rule intact:* nothing here writes `store.workouts`; `historySetPrefill` /
  `lastSetsForExercise` read finished workouts only, unchanged. `finishWorkout` drops the field.
- *Warm-up → first working set: NO (default kept).* `wu` and `work` are separate keys, so a
  warm-up change reaches only later warm-up sets. Reads correctly — flagged per the spec, no
  change from default.

## Receipts

```
# ./check
# tests 243 / pass 243 / fail 0   (was 225 on main; +18)
check: green — lint, 20 test file(s), and the build all passed.
```

New tests: `workout-log.test.js` — `seedOverrideKey` (1), `setLogSeed override` (5, incl. field
isolation, restore-wins, bodyweight-gate, no-override parity), `nextSeedOverrides` (8, incl.
field isolation both ways, numeric equality 5≡5.0, wu/work separation, cross-exercise isolation,
"until changed again"). `model.test.js` — seedOverrides survives migration + an older
activeWorkout without it loads (2). `store.test.js` — startWorkout inits `{}` + finishWorkout
strips it (2).

Acceptance criteria:
- **Live carry:** `nextSeedOverrides` records the change → `setLogSeed` seeds the next set from
  it. ✓ (pure tests; live click is the Emilio item)
- **Field isolation (failure case):** ✓ tested both directions.
- **No cross-exercise leak:** ✓ tested.
- **History rule intact (regression):** ✓ no finished-workout write; finish strips the field.
- **No regression / no schema bump:** ✓ `./check` green; migration test proves old + new keys load.

## Workflow

- **Mechanism decision (spec left it to me):** session-scoped override map on `activeWorkout`,
  not seed-from-last-logged — reasoning above (the target-per-set case makes the naive version
  violate no-invent). Kept the existing req-02 no-history `carry` untouched; the override simply
  layers above it (they agree for the no-history case).
- **Added a small cleanup beyond the strict diff:** `finishWorkout` strips `seedOverrides` off
  the finished record. Without it, `...s.activeWorkout` would carry the transient map onto
  finished history — harmless to prefill (which reads `sets`) but it contradicts "cleared at
  finish," so I removed it and locked it with a test.
- **No scope added/dropped;** no template write (option (b) not built); no history-prefill change.
- **Warm-up→first-working carry:** default NO kept; reads fine — flagged as the spec asked.
- **Nothing that needs a new DEC/L** beyond recording the mechanism choice, which is in this report.

## What I could not verify myself
- The live in-gym flow in the browser (bump warm-up 4→5kg, complete, see 5kg pre-filled on the
  next warm-up set; change weight only and confirm reps stay at target) — Chrome extension not
  connectable from this session. The decision is pure and unit-tested and the store wiring is
  locked by source tests; what remains is confirming it feels right on a real device.
