# req-128 — small leftovers: History "Main", summary vs a skipped prior, first-item rest, wake-lock, dead code (audit Tier 3 + follow-ups)

**Status: BUILT AND MERGED, 2026-09-23 — branch `req-128` (`ed65ad5`…`ed65ad5`, 1 commit).** Phase 1. **[P]**: touches `storage.js` / `schedule.js` (DEC-057:
reviewer + backup reminder). No stored-data change.

## Why (each is a follow-up already in BACKLOG, re-verified on main)

1. History detail still prints "Main" on every row (`history/detail.jsx`; the req-93 rule, req-103 follow-up).
2. The auto-complete "vs last time" (`workoutSummaryStats`, `storage.js:~535`) compares against the previous
   same-routine workout even when it was all skipped (req-111 follow-up a), so the deltas are nonsense.
3. `historyPrescription` takes the **first** snapshot item of an exercise (`storage.js:~485`), so after a req-109
   replacement it reads the replacement's rest 0 and empty notes (req-109 follow-up b). (beat-last-time only reads
   type/name from it, so it's out of scope.)
4. Wake-lock holds while any active workout exists (`wake-lock.js:21`), including a days-old stale one, while you
   browse Settings (audit gym nit; req-114 left it out of scope).
5. Dead code: `nextOccurrence`, `nextDateForSlot` (`schedule.js:102,150`; test-only callers), `parseTargets`
   (`ids.js:104`; no caller since req-118).

## The behaviour

1. History detail rows follow the req-93 rule (main unlabelled; warm-up/finisher tagged).
2. The summary compares against the most recent previous same-routine workout for which `anythingLogged`
   (`workout-log.js:~334`) is true; none → no deltas.
3. `historyPrescription` prefers the snapshot item that is **not** `addedMidWorkout` for `restSec` **and** `notes`,
   falling back to the first.
4. Wake-lock holds only while a `/workout/…` route is open **and** a workout is active **(unconfirmed)**.
5. Remove the three dead functions and **their tests** (named in the report; deleting tests of deleted code is not a
   weakening).

## Scope

`history/detail.jsx`, `storage.js`, `beat-last-time.js`, `wake-lock.js`, `schedule.js`, `ids.js`, tests.

## Order vs siblings

After req-127 (independent files, but serial per batch).

## Acceptance criteria

- **Unit/static for each of 1–5.** For 3 the fixture has the exercise twice, the replacement **before** its own
  routine item (otherwise "first" = "not mid" and the test passes trivially). For 2 (failure case): prior all-skipped and the one before logged → deltas vs the
  logged one; only all-skipped priors → no deltas.
- **Wake-lock (unit on a pure predicate):** active + `/settings` → false; active + `/workout/r` → true; none → false.
- `./check` green (receipt quoted); `grep` shows no remaining reference to the removed functions.
