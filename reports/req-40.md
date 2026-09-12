# req-40 — one shared progression computation (Finish == recalc) (audit F-CODE-1)

Branch `req-40`. **Persisted-data / behaviour gate (DEC-009) → Emilio's hands before
merge.** Not merged.

## Technical

The per-item progression was computed twice with divergent set-matching — inline in
`finish.jsx` (what Finish SAVES onto the routine via
`finishWorkout → applyProgressionToRoutines`) and in `progressionFromWorkout`
(`model.js`, the History-recalc path). Same workout → possibly two different saved
recommendations (fails DESIGN §2). Unified onto one pure helper, reconciled to the
fuller model.js semantics.

**`src/model.js`** — new pure `progressionForItem(exercises, workout, item)`:
- Canonical set match: a working set matches when
  `(set.routineItemId || set.sessionItemId)` equals the item's id-or-fallback
  (`routineItemId || sessionItemId || id`) **or** its raw `item.id`; excludes `wu` and
  `skipped`. (finish.jsx's old filter matched `set.routineItemId === itemKey(item)`
  **only** — it missed `sessionItemId`-keyed and `item.id`-keyed sets.)
- Empty-sets fallback: with no matched working sets, keeps `item.suggestedWeights` /
  `item.targets` rather than a from-zero recommendation.
- Returns `{ routineItemId, sets, recommendation, to, targetsTo }` — the core both
  callers need.
- `progressionFromWorkout` rewritten to map snapshot items through the helper and
  return its unchanged `{ routineItemId, to, targetsTo }` shape.

**`src/views/workout/finish.jsx`** — the `progression` map now calls
`progressionForItem(store.exercises, active, item)` for the saved core
(`routineItemId`, `to`, `targetsTo`) and wraps its **display-only** fields around it
(`from`, `exerciseId`, `name`, `targetsFrom`, `action` from `core.recommendation`,
`reason` from `core.sets.length`/`skippedForItem`). The inline set-filter,
`recommendNextPrescription`, `exerciseById`, and `itemKey` imports are gone (the helper
subsumes them). The `finishWorkout({ progression })` call shape is unchanged.

**Canonical choice (record as DEC at merge):** where the two diverged, model.js wins —
the fuller matcher + keep-`item.targets` empty-sets fallback. finish.jsx's narrower
`routineItemId`-only match was the bug.

### Domino-effect check (progression shape consumers)
The progression objects flow to: `finishWorkout` (`store.jsx`, stores them on the
finished workout + forwards to `applyProgressionToRoutines`), `applyProgressionToRoutines`
(`model.js`, keys by `routineItemId || sessionItemId`, reads `.targetsTo`/`.to`), and
the Finish screen's own display (`from`/`to`/`targetsTo`/`reason`). The helper preserves
the **exact** `routineItemId` both old paths emitted (`item.routineItemId ||
sessionItemId || id`), and the `{ to, targetsTo }` field names/shape are unchanged — so
`applyProgressionToRoutines` still resolves and applies them. Asserted by the existing
`applyProgressionToRoutines` test ("writes next kg and reps onto the routine exercise")
staying green, plus the recalc-path tests below.

### What changed for saved data
For the common case (active-workout sets carry `routineItemId`) the saved
recommendation is **unchanged** — the regression-guard test proves the routineItemId
path yields the identical `{to, targetsTo}`. It **can** change for
`sessionItemId`-keyed or `item.id`-keyed working sets: Finish previously saw zero sets
there and saved the stale weight; it now saves the real recommendation (matching what
recalc always produced). That correction is the point of the req — hence the
Emilio-hands gate.

### Tests — `src/model.test.js`, new `req-40 unified progression` describe
- **consistency (the point):** a workout whose working set is keyed by `sessionItemId`
  only → `progressionForItem` matches it (`to: [45]`, a real +5kg step), and
  `progressionFromWorkout` returns the **same** `{to, targetsTo}`. The test also shows
  the OLD finish matcher saw zero sets there and would have saved the stale `[40]` —
  the divergence, made concrete.
- empty matched sets keep `item.targets`/`item.suggestedWeights` (not from-zero).
- regression guard: a normal `routineItemId`-keyed workout still yields
  `{ routineItemId:'ri-1', to:[45], targetsTo:['8'] }`.
- warm-up + skipped sets are both excluded.

### Verification
Acceptance grep — inline filter gone (empty, exit 1):
```
$ git grep "setType !== 'wu'" src/views/workout/finish.jsx
$ echo exit: $?
exit: 1
```
New tests green:
```
# Subtest: req-40 unified progression (Finish == recalc)
    ok 1 - the fuller matcher catches a sessionItemId-keyed set the old finish matcher missed
    ok 2 - empty matched sets keep item.targets / item.suggestedWeights, not a from-zero recommendation
    ok 3 - a normal routineItemId-keyed workout yields the same recommendation as before (regression guard)
    ok 4 - a warm-up and a skipped set never feed the recommendation
ok 3 - req-40 unified progression (Finish == recalc)
```
`model.test.js`: `# tests 11 # pass 11 # fail 0`.
`./check` green:
```
check: green — lint, 15 test file(s), and the build all passed.
```
Diff scope (`progress.js` and `applyProgressionToRoutines` untouched, per out-of-scope):
```
 src/model.js                 | 67 +++++++++----
 src/model.test.js            | 79 +++++++++++++
 src/views/workout/finish.jsx | 34 +++-------
 3 files changed, 133 insertions(+), 47 deletions(-)
```

Acceptance criteria: both callers derive their core from the same helper, no inline
filter (grep empty) ✅; consistency test — same workout → same `{to, targetsTo}` on both
paths ✅; `./check` green, existing progression/recalc tests green ✅.

## Workflow

- Built to spec: pure helper in `model.js` (L-007), both callers refactored onto it,
  finish.jsx keeps its display fields. `recommendNextPrescription` /
  `applyProgressionToRoutines` untouched.
- **DEC to record at merge (spec §Canonical choice):** unify to model.js's matching +
  empty-sets fallback; finish.jsx's `routineItemId`-only match was the bug.
- **Could not verify (L-007):** `finish.jsx` can't be imported under `node --test` (no
  JSX transform), so the test asserts the shared helper's output and confirms by code
  that finish.jsx calls `progressionForItem` (and no inline filter remains, grep). The
  browser gate below covers the view end-to-end.

## Ready to look at (merge gate — branch `req-40`)

1. **What it does**: Finish and the History "correct → recalculate" preview now compute
   the next-time weights/reps the same way, so the same workout can't produce two
   different saved recommendations. For normal workouts nothing you see changes; the fix
   only affects edge-keyed or all-skipped items.

2. **What to test** (open the app on branch `req-40`; L-001 — snapshot the real key
   first if you plant anything):
   1. Do a normal workout, log real sets, Finish. On the "Next time" list, do the
      shown weights/reps read right for what you lifted? (y/n)
   2. Open that routine — are the `suggestedWeights`/`targets` it now shows the same as
      the "Next time" list said? (y/n)
   3. In History, "Correct" that workout and view the recalculate preview — does it
      match what Finish wrote (not a different number)? (y/n)
   4. A workout where you skipped an exercise entirely: does Finish show "Skipped." and
      leave that exercise's routine weights unchanged? (y/n)

3. **What I could not verify myself**: the on-device Finish/recalc screens (view code
   isn't unit-testable), and that the two now agree on your real data — the unit tests
   prove the shared helper and both model-side callers agree; the browser confirms the
   view uses it.
</content>
