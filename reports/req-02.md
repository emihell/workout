# req-02 — carry entered kg + reps across sets for a no-history exercise

Branch: `req-02-carry-value-no-history`. Implements DEC-002: for an exercise with **no
finished-workout history**, logging a working set seeds the next working set's kg + reps from the
most recent non-skipped working set logged **this session**. An editable prefill, not invented data
(it's the user's own input) — exercises *with* history keep their per-set history prefill unchanged.

## Technical

### The seam
The set-log prefill is initialised in `SetLogForm` (`src/views/Workout.jsx`). Before this change the
initial values were: `weight = usesWeight(ex) ? (restore ?? history).weight : ''` and
`reps = fromRestore ? restore.reps : (target || '')`. So weight came from history-prefill and reps
came from the per-set **target** (history reps for a with-history exercise are already baked into
`item.targets` at snapshot time). Nothing carried a value forward within the current session, so a
no-history exercise showed blank kg / target reps on every set.

### What changed
- **Two pure helpers in `src/workout-log.js`** (kept pure so the prefill decision is testable
  without the DOM, per the "reasoning made visible" rule):
  - `carriedWorkingSet(workLogged)` — scans the session's logged working sets newest-first and
    returns the most recent **non-skipped** one, or `null` when there is nothing to carry (no
    working set logged yet, or every one skipped). This is the "follows the most recent set" and
    "skipped source ignored" behaviour from DEC-002, in one place.
  - `setLogSeed({ weighted, fromRestore, restore, hasHistory, history, carry, target })` — the
    prefill decision as an ordered function: **restore** (un-logging via "Previous") →
    **carry** (no-history only) → **history weight + target reps** (has-history, and the first set
    of a no-history exercise). `weighted` gates kg. The `!hasHistory && carry` guard makes the
    scope rule ("with history never carries") explicit and testable.
- **`carryFor(ex, last, currentType, workLogged)` in `Workout.jsx`** — returns the carry prefill
  `{ weight, reps }` only for a **working set** of a **no-history** exercise (`last` is null); null
  otherwise, so warm-ups and with-history exercises are untouched. Formats weight to `''` when it's
  `0`/absent, matching the existing history/restore convention.
- **`WorkoutItemLive`** passes `carry={carryFor(ex, last, currentType, state.workLogged)}` to
  `SetLogForm`. `last` is `lastSetsForExercise(store.workouts, item.exerciseId)` — null means "no
  history", the exact condition the spec names.
- **`SetLogForm`** now derives `weight`/`reps` initial state from `setLogSeed(...)`. `rpe` and
  `note` initialisers are unchanged — **effort does not carry** (stays at the Moderate default each
  set). The `key={itemKey-currentType-currentWorkIndex}` remount per set means the seed is
  recomputed from fresh props for every set, so the carry follows forward automatically.

### What did NOT change
The with-history path (history-prefill weight + target reps), the warm-up path (its own warm-up
prefill), the "Previous"/restore path, and effort defaulting. The save path (`completeSet`/`skipSet`)
is untouched — this is purely the seed/prefill path.

### Verification — unit tests (receipts)
Added to `src/workout-log.test.js`, one per acceptance criterion:

- `carriedWorkingSet`: carries most recent (`40×10, 42.5×8 → 42.5×8`); `[]`/`undefined → null`
  (first set not seeded); skips a trailing skipped set to the last non-skipped (`→ 40×10`); all
  skipped `→ null`.
- `setLogSeed`: carry main (no-history weighted → `40 / 10`); reps carry overrides target
  (`target 10`, carry reps `8` → `8`); first set → blank kg / target reps (`'' / 10`); **scope
  guard** — with history uses history weight + target reps and ignores a carry (`60 / 5`, not
  `99/99`); bodyweight keeps kg blank; restore wins over carry.

`./check` — green:

```
# tests 73
# pass 73
# fail 0
check: green — lint, 10 test file(s), and the build all passed.
```

### A choice the spec left open
`carryFor` returns a prefill only for `currentType === 'work'`. The spec's carry is defined for
working sets; warm-up is explicitly out of scope, so warm-up sets get `carry = null` and keep their
warm-up prefill. (Not a behaviour decision beyond the spec — just where I drew the guard.)

## Workflow

- **No scope changes, no scope dropped.** Built exactly the spec + DEC-002.
- **Refactor that rode along:** rather than inlining the carry as more ternaries in `SetLogForm`, I
  extracted the whole prefill order into the pure `setLogSeed` and the carry source into
  `carriedWorkingSet`. This follows the repo's "anything that computes a value the user sees gets
  its reasoning made visible / testable" rule (same posture as `historySetPrefill`). It slightly
  restructures `SetLogForm`'s init (weight/reps now come from one `seed` object) but the with-history
  and restore behaviour is byte-for-byte the same — covered by the scope-guard and restore tests.
- **No decisions needed from Emilio** — DEC-002 settled both forks (kg+reps both carry; follows most
  recent). Nothing surfaced that should become a new `DEC-`/`L-`.

## Ready to look at (functional gate — DEC-009)

Open the app on branch `req-02-carry-value-no-history` (`npm run dev`). Use an exercise with **no
prior finished workouts** (a freshly created weighted one).

1. Start a workout with that exercise. First working set: kg is **blank**, reps show the target. ✅/❌
2. Log set 1 at e.g. **40 kg × 10** → set 2's form is pre-filled **40 kg × 10** (both fields). ✅/❌
3. On set 2, change to **42.5 kg × 8** and log → set 3 pre-fills **42.5 × 8** (follows the most
   recent, not set 1). ✅/❌
4. The pre-filled values are **editable** — you can overwrite before logging. ✅/❌
5. **Skip** a set → the next set does **not** show `skipped` / `0 kg`; it falls back to the last
   non-skipped set (or blank kg / target reps if none). ✅/❌
6. An exercise that **does** have history still prefills per-set from history, **not** from the
   previous live set. ✅/❌

What I could not verify myself: everything above in a real browser (the DOM wiring of `SetLogForm`),
and how it feels in the gym flow. The prefill *logic* — the carry source and the seed order for all
six cases — is unit-tested and green; the browser check is that `SetLogForm` renders those values.
