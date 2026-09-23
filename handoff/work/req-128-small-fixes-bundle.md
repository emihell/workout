# req-128 — small leftovers: History "Main", summary vs a skipped prior, first-item rest, wake-lock, dead code (audit Tier 3 + follow-ups)

**Status: SPEC — READY, held for Emilio's go.** Phase 1. **[P]**: touches `storage.js` / `schedule.js` (DEC-057:
reviewer + backup reminder). No stored-data change.

## Why (each is a follow-up already in BACKLOG, re-verified on main)

1. History detail still prints "Main" on every row (`history/detail.jsx`; the req-93 rule, req-103 follow-up).
2. The auto-complete "vs last time" (`workoutSummaryStats`, `storage.js:~535`) compares against the previous
   same-routine workout even when it was all skipped (req-111 follow-up a), so the deltas are nonsense.
3. `historyPrescription` and beat-last-time take the **first** snapshot item of an exercise (`storage.js:~485`), so
   after a req-109 replacement they read its rest 0 (req-109 follow-up b).
4. Wake-lock holds while any active workout exists (`wake-lock.js:21`), including a days-old stale one, while you
   browse Settings (audit gym nit; req-114 left it out of scope).
5. Dead code: `nextOccurrence`, `nextDateForSlot` (`schedule.js:102,150`; test-only callers), `parseTargets`
   (`ids.js:104`; no caller since req-118).

## The behaviour

1. History detail rows follow the req-93 rule (main unlabelled; warm-up/finisher tagged).
2. The summary compares against the most recent previous same-routine workout **with anything logged** (DEC-053's
   rule); none → no deltas.
3. `historyPrescription` / beat-last-time prefer the snapshot item that is **not** `addedMidWorkout`, falling back to
   the first.
4. Wake-lock holds only while a `/workout/…` route is open **and** a workout is active **(unconfirmed)**.
5. Remove the three dead functions and **their tests** (named in the report; deleting tests of deleted code is not a
   weakening).

## Scope

`history/detail.jsx`, `storage.js`, `beat-last-time.js`, `wake-lock.js`, `schedule.js`, `ids.js`, tests.

## Order vs siblings

After req-127 (independent files, but serial per batch).

## Acceptance criteria

- **Unit/static for each of 1–5.** For 2 (failure case): prior all-skipped and the one before logged → deltas vs the
  logged one; only all-skipped priors → no deltas.
- **Wake-lock (unit on a pure predicate):** active + `/settings` → false; active + `/workout/r` → true; none → false.
- `./check` green (receipt quoted); `grep` shows no remaining reference to the removed functions.
