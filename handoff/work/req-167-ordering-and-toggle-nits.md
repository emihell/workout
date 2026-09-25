# req-167 — req-163's reviewer leftovers: timestamp ordering and the History type toggle

**Status: READY** (2026-09-25) — **Lane: bug** (small). DEC-087 (follow-ups before features). Reviewer fires (storage.js).
Reproduce each on main first (L-042).

1. **Mixed-offset timestamps sort wrong** (latent): `finishedNewestFirst` (`storage.js:562`) compares `finishedAt` as a
   string; `sortWorkoutsByDate` (`history/helpers.js:96`) as a Date. An imported file with `09:30Z` vs `11:00+02:00` →
   they disagree (reviewer probe). **Fix:** both compare by parsed time (`Date.parse`), invalid last; one shared comparator.
2. **A workout without `finishedAt`** is now dropped from Finish/auto-complete priors (and prefill already dropped it).
   Normal data always has it. **Fix:** decide by the same comparator — a legacy/imported workout with only a `date` (or
   `performedOn`) sorts by that; say what main's migration guarantees and pin it.
3. **History toggle Work→WU keeps `durationSec`** (`set-edit.jsx`): a WU row then shows "46s". **Fix:** WU saves
   `durationSec: null`, like the live form (`workout-log.js:746`).
4. **History toggle WU→Work revives a legacy `rpe 3` as "Moderate"** (`set-edit.jsx:41`). **Fix:** a WU/cardio set's legacy
   stored rpe isn't carried into the Work form's Effort (starts unset, as a fresh work set would).

5. **Test gaps from req-164's review:** (a) `startedWorkoutState` has no behaviour test for a scheduled start
   (`scheduleSlotId`/`scheduledFor`/`suppliedPlan` — the `scheduledFor: plan.scheduleSlotId ? plan.date : null` branch);
   (b) the store → reducer argument order is pinned for only 3 of 22 calls — add a store-level test that drives each
   store action once through the real store and checks the state it produces.

## Acceptance criteria

- A test per item that fails on main and passes on the branch (paste both).
- `./check --smoke` green (paste). Reviewer before merge.
