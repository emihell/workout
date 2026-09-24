# req-158 — stop recording two persisted fields nothing reads

**Status: READY** (2026-09-24) — Phase 1 debt, **persisted schema** (reviewer before merge; no schema-version bump, no
rewrite). DEC-085 §3. Source: `audits/2026-09-24.md` **F-DEAD-4** (and F-DEAD-3 for context).

1. `legacyRecommendations`: `model.js:24-42,270` adds an entry per v9 routine item on each load, which is then saved;
   nothing reads it on v9. **Stop adding entries for v9 data**; keep reading it for legacy (v8-and-older) migration exactly
   as today; leave existing entries in stored data untouched.
2. `workout.progression`: saved at every Finish, read nowhere, stale after a set edit. **Stop writing it** on new finishes;
   old workouts keep theirs; nothing may start reading it.

## Acceptance criteria

- A migration test: a v8 fixture still migrates identically (legacy baselines used as today) — paste the before/after
  deep-equal.
- Unit: loading v9 state twice doesn't grow `legacyRecommendations` (count before = after); a new Finish has no
  `progression`; an old workout's `progression` survives load/save unchanged.
- Report the dev data's `legacyRecommendations` entry count and workouts with `progression` (information only).
- `./check` green (paste). Reviewer before merge.
