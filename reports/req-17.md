# req-17 — extract `initialSetFields` — report

**Branch:** `req-17` · **Gate:** code-only (DEC-009) · behaviour-neutral, output-parity is the contract.

## Technical

### What changed

- **`src/workout-log.js`** — new exported pure function `initialSetFields({ weighted, fromRestore, restore, hasHistory, history, carry, target })` beside `setLogSeed`. It delegates weight+reps to the existing `setLogSeed` (unchanged) and adds the `effort` and `note` decisions that used to live in the component. Returns `{ weight, reps, effort, note }`. Added `import { rpeOptionValue } from './ids.js'` (ids.js is a leaf module — no import cycle).
- **`src/views/Workout.jsx`** — `WorkoutItemLive` now calls `initialSetFields(...)` once and passes `seed.weight/reps/effort/note` to `SetLogForm`. Removed the inline `setLogSeed` call, `initialEffort`, and `initialNote`. The component retains **no** seed/prefill branching. Imports updated: `setLogSeed` → `initialSetFields` from `../workout-log`; `rpeOptionValue` import kept (still used at Workout.jsx:707 for the set-edit form).
- **`src/workout-log.test.js`** — new `describe('initialSetFields ...')` block, 6 tests.

### Implementation choices (spec left these to me)

- **Field set returned: `{ weight, reps, effort, note }`.** That is exactly the four values `SetLogForm` seeds (`initialWeight/Reps/Effort/Note`). Reps comes through `setLogSeed`, so it rides along for free — no separate reps decision exists in the component.
- **`historySetPrefill` stays in `WorkoutItemLive`.** It needs `last`/`currentType`/`currentWorkIndex` from render, and its result is passed in as `history` — same boundary `setLogSeed` already used. Moving it would drag render-only state into the pure function for no gain.
- **`carryFor` (Workout.jsx:276) also stays in the component** for the same reason (needs `ex`/`last`/render state); its result is passed as `carry`, unchanged.
- **Exact parity preserved, not "cleaned up".** `note` is `fromRestore ? restore.note : ''` (unguarded `restore.note`, exactly as before — `fromRestore` truthy implies `restore` truthy, and `restoreFromLoggedSet` always writes a string note). `effort` is the identical expression `fromRestore && restore.rpe != null && restore.rpe !== '' ? rpeOptionValue(restore.rpe) || restore.rpe : 3`. The default effort is **3** ("Moderate") — read from the inline code, not guessed.

### No discrepancy found

The spec asked me to stop and report if the inline code and `setLogSeed` disagreed on any edge. They don't — the inline path *was* calling `setLogSeed` for weight/reps; only effort/note were extra, and those are now moved verbatim.

## Verification (receipts)

Acceptance criteria, each covered by a test in `initialSetFields (req-17 seed extraction)`:

- **No-invent rule:** weighted + no history + no restore → `{ weight: '', reps: '10', effort: 3, note: '' }` (blank kg, not a guess). ✔
- **History prefill:** weighted → weight equals history-derived kg; bodyweight → weight blank, reps from history. ✔ (both tested)
- **Restore wins when `fromRestore`:** weight/reps/effort/note all from `restore`; empty `restore.rpe` falls back to default `3`. ✔ (two tests)
- **Parity table:** 3 representative inputs asserted equal to a recomputed copy of the old inline expressions. ✔

`./check` output:

```
# tests 105
# pass 105
# fail 0
check: green — lint, 13 test file(s), and the build all passed.
```

## Workflow

- No scope added or dropped; no fixes rode along. Pure extraction as specced.
- No decisions needed from Emilio — all choices above are implementation, not behaviour.
- Nothing to become a new DEC-/L-. The implementation choices (field set, `historySetPrefill`/`carryFor` staying in render) are recorded here per the spec's "note in report" ask.

## Ready to look at (browser — planning verifies)

1. **what it does** — Moves the live set-log form's seed logic (starting weight, reps, effort, note) out of `WorkoutItemLive` into a pure, unit-tested `initialSetFields`. No user-visible change intended; the form should prefill identically to before.
2. **what to test**
   1. Start a workout on a **new** weighted exercise (no history) → weight field is **blank**, reps show the target, effort defaults to "Moderate".
   2. An exercise **with** history → weight prefills to the history value.
   3. Log a set, then hit **Previous** → weight/reps/effort/note restore to that logged set.
3. **what I could not verify** — the in-browser prefill values (only unit-tested the pure function). Everything automated is green.
