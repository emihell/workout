# req-44 — cleanup: dead export + dedupe drifted predicates (F-DEAD-1, F-STRUCT-1/2/3/5)

Branch `req-44`. Pure refactor, **no behaviour change** (one intentional latent-bug
fix — finish.jsx). Gate: functional; **L-005 applies** — the real gate is a browser
walk (below), not just `./check`.

## Technical

**What changed** (five dedups, all value-preserving)

1. **F-DEAD-1** — removed dead `nextScheduled` from `schedule.js` (no live caller).
2. **F-STRUCT-2** — `isSkippedSet` is now one exported helper in `workout-log.js`.
   Removed the `storage.js` duplicate; replaced the inline copies in `model.js`
   (×3: :88/:152/:321), `item.jsx` (×2: skipped, lastLoggedWeight guard), and
   `finish.jsx`. **finish.jsx fix:** it used `String(set.reps).toLowerCase()` —
   dropping the `|| ''` guard — so a `null`/`undefined` `reps` would `String()` to
   `"null"`/`"undefined"` instead of `""`. The shared helper guards it. This is the
   one place behaviour changes, and only for the null-reps edge (a skipped set
   always has `reps:'skipped'`, so the common path is unchanged).
3. **F-STRUCT-1** — `isDurationTarget` exported from `progress.js`; `item.jsx`
   imports it and its identical private copy is gone.
4. **F-STRUCT-3** — added pure `isWeightedType(type)` to `ids.js`, replacing four
   spellings. Each caller keeps reading its own field:
   - `item.jsx` `usesWeight(ex)` → `isWeightedType(ex.type)` (×2).
   - `item.jsx` `usesLoad` → `isWeightedType(item?.exerciseType)`.
   - `model.js` `weighted` → `exercise && isWeightedType(exercise.type)`.
   - `progress.js` `bodyweight` → `!isWeightedType(exercise?.type)`.
5. **F-STRUCT-5** — `Routine.jsx` `ExerciseFields` already had a `weightParts`
   const for the `count` max; reused it for `suggestedWeights` instead of splitting
   `weights` a second time.

**Value-preservation notes (the pure-move check)**

- `isWeightedType(type) = type !== 'bodyweight' && type !== 'cardio'`.
  - `item.jsx`: `ex` comes from `liveExercise`, which **always returns a truthy
    object**, so the old `ex && …` guard in `usesWeight` was inert — dropping it
    changes nothing. `usesLoad` keeps `item?.exerciseType`, so the `item`-undefined
    case (`undefined !== 'cardio' && …` → `true`) is preserved by
    `isWeightedType(undefined) → true`.
  - `model.js`: kept the `exercise && …` truthiness guard (used in
    `Boolean(weighted && …)`), so a missing exercise still yields falsy.
  - `progress.js`: `!isWeightedType(exercise?.type)` equals the old
    `exercise?.type === 'bodyweight' || exercise?.type === 'cardio'` for every input
    (incl. `undefined` → `false`).
- `Routine.jsx`: the old second split used `weights.split(...)` (no `String()`),
  the first used `String(weights || '')`. `weights` is `useState` seeded from
  `.join('/')`, always a string, so `weightParts` (`String(weights||'')…`) equals
  the removed expression for every reachable value.

**Import audit (L-005) — per touched file, every used symbol resolves:**

- `schedule.js` — removed `nextScheduled`; its internal helpers (`clampLoopWeeks`,
  `addDays`, `slotsOn`, `resolveSlot`) remain used by other exports. No new imports.
- `workout-log.js` — `isSkippedSet` now `export`; still used internally
  (`carriedWorkingSet`). No new imports.
- `storage.js` — `+import { isSkippedSet } from './workout-log.js'`; used in
  `workingSetsFromHistory` / `historySetPrefill`. Local dup removed.
- `model.js` — `+import { isWeightedType } from './ids.js'`, `+import { isSkippedSet
  } from './workout-log.js'`; both used. No cycle (`ids`/`workout-log` don't import
  `model`).
- `finish.jsx` — `+import { isSkippedSet } from '../../workout-log'`; used at :34.
- `item.jsx` — `+isWeightedType` (from `../../ids`), `+isDurationTarget` (from
  `../../progress`), `+isSkippedSet` (added to the existing `../../workout-log`
  block); removed local `usesWeight` + `isDurationTarget`. All uses (211/272/273/438,
  120/305) resolve. No stray `usesWeight` reference remains.
- `progress.js` — `+import { isWeightedType } from './ids.js'`; used at :71.
  `isDurationTarget` now `export`.
- `ids.js` — `+export function isWeightedType`. No imports (no cycle possible).
- `Routine.jsx` — no import change; reuses existing `weightParts`.

Cycle check: `ids.js` imports nothing; `workout-log.js` imports only `ids.js`;
`progress.js` imports only `ids.js`. Nothing new points back at `storage`/`model`,
so no import cycle was introduced.

## Verification

`nextScheduled` and old spellings gone (greps):

```
$ git grep -n nextScheduled src        → (nothing)
$ grep -rn "function isSkippedSet" src → src/workout-log.js (1)
$ grep -rn "function isDurationTarget" → src/progress.js (1)
$ grep -rn "function isWeightedType"   → src/ids.js (1)
$ grep -rn "usesWeight\|usesLoad" src  → only a comment + the local `usesLoad` const
```

New pure tests pass, incl. `isSkippedSet` on `{reps:null}` / `{}` / `undefined`:

```
ok - req-44 isWeightedType (unifies usesWeight/usesLoad/weighted/bodyweight)
ok - req-44 isDurationTarget (was duplicated in item.jsx)
ok - req-44 isSkippedSet (one shared guarded predicate)
# tests 62 / # pass 62 / # fail 0   (ids + workout-log + progress test files)
```

`./check` green:

```
check: green — lint, 15 test file(s), and the build all passed.
```

## Workflow

- No scope deviation — the five dedups exactly, no logic change beyond the one
  documented finish.jsx guard fix (which the spec called for).
- No `DEC-`/`L-` candidates. L-005 was the governing risk and is addressed by the
  import audit above + the browser-walk request below.

## What I could not verify (L-005 — the real gate is a browser walk)

`./check` cannot prove a cross-module relocation renders — a forgotten import
passes lint+build+tests and only blank-screens at runtime. I did the static import
audit above; the runtime walk of the affected screens is yours (or Emilio's):

1. **Workout set-log** (item.jsx): open an active workout, log a weighted set, a
   bodyweight set (no kg field), skip a set — all render and behave as before.
2. **Finish** (finish.jsx): finish a workout that includes a skipped exercise — the
   progression list renders, skipped item handled.
3. **Routine editor** (Routine.jsx): edit an exercise's sets/weights — the
   suggested-weights and set count still compute correctly.
4. **Exercises**: list + detail render.

No blank screen on any of these = the relocation is sound.
