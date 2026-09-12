# req-38 — stamp `performedOn`/`plan.date` in local time, not UTC (audit F-CODE-2)

Branch `req-38`. Functional gate (planning merges). **Go-forward value change** on new
writes, no migration. Not merged.

## Technical

`store.jsx` built the day key inline as `new Date().toISOString().slice(0, 10)` (UTC)
at two sites; every other day key in the app is local via `dateKey`
(`schedule.js:15-21`). Near midnight for an off-UTC user the two disagreed, landing a
new workout's stored date a day off from how the app groups/displays it.

**`src/store.jsx`** (3 lines):
- `:5` — import: `import { clampLoopWeeks, dateKey } from './schedule'` (added
  `dateKey`).
- `:214` — `startWorkout` plan default: `date: scheduledFor || dateKey(new Date())`.
- `:233` — `activeWorkout.performedOn: dateKey(new Date())`.

Nothing else. No migration, no schema change, `dateKey` itself untouched.

### Test approach (step 3 was CC's call) — `src/store.test.js` (new)
The store lives in `store.jsx` and **cannot be imported under the project's `node --test`
runner** (plain node, no JSX transform — which is why no existing test imports the
store; `rest-cue`/`wake-lock`/`error-boundary` only import `.js` modules). So driving
`startWorkout` directly isn't reachable without adding a JS-transform toolchain — a
refactor well beyond this fix. Per the spec's step-3 allowance, I proved the fix the
two ways that ARE reachable in plain node, deterministically:

1. **Behavioural discriminator** — run under `TZ=Pacific/Kiritimati` (UTC+14) with the
   no-arg `new Date()` pinned to a fixed boundary instant (`2026-03-10T20:00:00Z` =
   `2026-03-11` local). Asserts `dateKey(new Date()) === '2026-03-11'` (local) while the
   old `new Date().toISOString().slice(0,10) === '2026-03-10'` (UTC) — the exact
   substituted expression, shown to be local and to differ from the pre-fix one at a
   real day boundary. Fully deterministic (fixed TZ + fixed clock); no dependence on
   wall-clock. `Date.now` is left real so nothing else is disturbed.
2. **Source guard** — reads `src/store.jsx` and asserts the UTC slice is gone
   (`toISOString().slice(0,10)` absent — the acceptance grep as a test), that
   `dateKey(new Date())` appears at **both** sites, and that `dateKey` is imported.
   This fails if either store line is reverted.

Together: the substituted expression is provably local-not-UTC, and both store sites
provably use it.

### Verification
Acceptance grep — empty (no match):
```
$ git grep "toISOString().slice(0, 10)" src/store.jsx
$ echo exit: $?
exit: 1
```
Both sites now local:
```
src/store.jsx:214:              date: scheduledFor || dateKey(new Date()),
src/store.jsx:233:              performedOn: dateKey(new Date()),
```
New test green:
```
# Subtest: req-38 day key is stamped in local time, not UTC
    ok 1 - dateKey(new Date()) is the LOCAL day, and differs from the old UTC slice
    ok 2 - store.jsx stamps both day keys via dateKey(new Date()), with no UTC slice left
ok 1 - req-38 day key is stamped in local time, not UTC
```
`./check` green (test files 14 → 15):
```
check: green — lint, 15 test file(s), and the build all passed.
```
Changeset: `src/store.jsx` (3 lines) + new `src/store.test.js`.

Acceptance criteria: UTC sites gone / grep empty ✅; `startWorkout` stamps via local
`dateKey` (proven behaviourally + source-guarded) ✅; `./check` green, existing tests
stay green ✅.

## Workflow

- Built to spec: the two-line swap + import, nothing else.
- **Test approach deviated from the "render the store" ideal** because `store.jsx` is
  not importable under `node --test` (no JSX transform in the gate). I used the
  spec-sanctioned lighter path — a deterministic TZ-offset test of the substituted
  expression plus a source guard — rather than introducing a test-transform toolchain.
  Flagging as a possible `L-`: **the store's behaviour (all of `store.jsx`) is
  currently unreachable by unit tests**; anything needing to exercise `startWorkout`,
  `finishWorkout`, etc. either tests the pure helpers they delegate to (`model.js`,
  `workout-log.js`) or needs a JSX-capable runner. Not a blocker here, but it bounds
  what a store-level test can assert.
- **Merge note for Emilio (go-forward value change):** existing workouts keep their old
  (possibly UTC-off-by-one) `performedOn`; only workouts started after this ships are
  stamped in local time. No existing record is changed — mixed old-UTC / new-local is
  expected and acceptable (a bulk rewrite is the invisible edit the ask-gate forbids).
</content>
