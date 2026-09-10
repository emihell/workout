# req-25 — last set of an exercise starts no rest timer

Branch `req-25`. Fixes gym-flow bug #5: completing the final work set of an
exercise jumped to the overview with **no rest running**.

## Technical

### Root cause (confirmed, matches spec)
`restAfterSet(done, skipped)` in `src/views/workout/item.jsx` returned no rest when
`done` (the last set), so the hardest set never rested. **Second cause found via the
domino check:** even after arming rest on the last set, `markItemDonePatch`
(`workout-log.js`) explicitly set `restEndsAt: null` / `restPausedRemaining: null`,
and it runs *immediately after* the rest patch (`markDoneAndGoToOverview` →
`store.patchActive`). So the view fix alone was insufficient — the mark-done patch
would have wiped the armed countdown before the overview's `RestBar` rendered. Both
were fixed.

### Changes
1. **`workout-log.js` — new pure `restPatchAfterSet({ restSec, skipped })`** (DESIGN
   rule: the "when does rest run" decision is now inspectable/testable outside the
   component). Rest is armed by *completion*, not suppressed by "is this the last
   set"; only `skipped` (or `restSec === 0`) suppresses it.
   - `restSec > 0`, not skipped → `restEndsAt = Date.now() + restSec*1000`
   - `skipped` → `{ restEndsAt: null, restPausedRemaining: null }` (unchanged)
   - `restSec === 0` → `{ restPausedRemaining: null }` (unchanged shape — leaves
     `restEndsAt` untouched; such an item is never armed, so nothing to clear)
2. **`workout-log.js` — `markItemDonePatch` no longer clears rest.** Dropped the
   `restEndsAt: null` / `restPausedRemaining: null` keys so the patch preserves the
   rest the completion path just armed. Marking done is now purely
   `completedItemIds`.
3. **`item.jsx` — `restAfterSet` delegates** to `restPatchAfterSet({ restSec:
   item.restSec, skipped })`. Navigation is unchanged: `completeSet` still computes
   `done` and still calls `markDoneAndGoToOverview` when `done`.

### Domino check (done before claiming ready)
- `markItemDonePatch` is called **only** from `markDoneAndGoToOverview` (item.jsx:87).
  Verified all three call paths of that function are correct under the change:
  complete-last-set (rest now preserved ✓), skip-last-set (`restPatchAfterSet` already
  returned null rest ✓), and the `!resting && plannedDone` useEffect (not resting, so
  nothing to preserve ✓).
- Confirmed `overview.jsx:99` renders `<RestBar />` on the main render path, so the
  armed rest shows there automatically (RestBar is self-hiding; req-03/DEC-003).

### Implementation choices (spec left open)
- **Pure fn:** `restPatchAfterSet({ restSec, skipped = false })` in `workout-log.js`,
  in the rest-timer section next to `restRemaining`. Uses `Date.now()` internally;
  tests assert `restEndsAt` is in the future rather than an exact value.
- **`done` dropped from `restAfterSet`:** once inert for rest, `restAfterSet(done,
  skipped)` became `restAfterSet(skipped = false)`. `done` is still computed in
  `completeSet`/`skipSet` for navigation only.

### Tests
Updated the existing `markItemDonePatch` test (it asserted the old rest-clearing —
called out and justified in the diff: it now asserts the patch carries **no** rest
keys, i.e. does not wipe an armed rest). Added a `restPatchAfterSet` suite.

```
node --test --test-name-pattern="restPatchAfterSet|does NOT touch rest"
ok 1 - workout logging
ok 2 - restPatchAfterSet (req-25 rest-on-completion)
# tests 5   # pass 5   # fail 0
```

Full gate:
```
# tests 109   # pass 109   # fail 0
check: green — lint, 13 test file(s), and the build all passed.
```

## Workflow
- **Deviation from the 1-file expectation:** the fix required editing
  `markItemDonePatch` too (the domino the spec flagged as a *check* was in fact a
  *second* clearing site that had to be fixed, not just verified). Called out here
  because the spec's "The change" section framed only the guard + extraction.
- **DEC-013 update to record:** completing the last set now arms a rest that runs on
  the overview (rest-on-overview, Emilio 2026-09-10). `markItemDonePatch`'s
  responsibility narrowed to marking done only — rest suppression now lives solely in
  `restPatchAfterSet` (skip / restSec 0).
- No scope added beyond the domino fix; navigation, skip, and non-last sets unchanged.

## What I could not verify myself
Needs Emilio/browser (gym-flow feel, DEC-009): complete the **last** work set of an
exercise with `restSec > 0` (e.g. Upper Body → Chest Press, restSec 90) → app drops to
the exercise list **and the rest bar is running there and ticks down**. And the
non-regressions: `restSec === 0` last set → no rest; **skipping** the last set → no
rest; every non-last set as before.
