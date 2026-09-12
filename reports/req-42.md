# req-42 — a recommendation with no valid increment holds (audit F-DIV-1, DEC-030)

Branch `req-42`. Gate: functional. `progress.js` is pure.

## Technical

**What changed** — both in `src/progress.js`, scoped to the no-increment path only.

1. `moveToValidWeight` — empty `options` now `return current` instead of inventing
   `Math.max(0, Math.round((current + direction * 0.5) * 2) / 2)` (the ±0.5 kg
   step). It holds everywhere it's used.
2. `recommendNextPrescription` — compute `hasIncrements = validWeights(exercise).length > 0`
   once (exercise is constant across the sets). In the weighted up/down branches,
   only move + set `movedUp`/`movedDown` when `hasIncrements`; otherwise push the
   actual weight and set neither flag, so `action` stays `'keep'` / `'Same load.'`
   rather than reporting `'up'`/`'down'` against an unchanged weight.

Has-increment behaviour (including at-ceiling/floor via the `?? options.at(-1)` /
`?? options[0]` fallbacks in `moveToValidWeight`) is untouched.

**Choice left open by the spec (mine):** the `hasIncrements` guard is an inner
`if` inside each up/down branch (rather than restructuring the branch conditions),
so the has-increment code path reads identically to before — minimal diff, easy to
see the no-increment case is the only new behaviour.

**Verification**

New `progress.test.js` cases (all pass):

```
ok 1 - dated recommendation loads
ok 2 - req-42 / DEC-030 — no valid increment holds (audit F-DIV-1)
# tests 6
# pass 6
# fail 0
```

The req-42 suite covers: `moveToValidWeight(40, {weightStep:'n/a'}, ±1) === 40`;
an `rpe<=2` set on an n/a exercise holds (`weights:[40]`, `action:'keep'`,
`reason:'Same load.'`); a `missed`/`rpe>=5` set holds likewise; regression — an
`Alt 4/5` exercise still moves down (`23 → 18`, `action:'down'`). The existing
`Alt 4/5` up test (`moves each easy set one valid load step`) stays green.

The 0.5 kg fallback is gone — the only remaining `0.5` is the comment describing
what was removed, not live code:

```
$ grep -n "0.5" src/progress.js
30:  // *valid* increments; a 0.5 kg default is a load the config never defines.
```

`./check` green:

```
check: green — lint, 15 test file(s), and the build all passed.
```

## Workflow

- No scope deviation. Exactly the two `progress.js` changes DEC-030 specifies plus
  the four test cases. No changes to `validWeights`, `Alt 4/5`, or the
  bodyweight/cardio branches.
- Nothing rode along; no mid-build decisions needed.
- **Note at merge (from the spec):** this changes the recommendation for
  `weightStep:'n/a'` exercises — the `addExercise` default (`store.jsx:172`). They
  now hold instead of drifting ±0.5 kg. Exercises with a real `weightStep` are
  unaffected.

## What I could not verify (functional gate — planning verifies + merges)

The pure logic is fully unit-tested above. The user-visible effect worth a glance
in the app: an exercise left at the default `weightStep` ('n/a') with a logged
weight now recommends the *same* load next time (no ±0.5 kg drift), and the
progression line reads "same next time".
