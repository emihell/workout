**Status: BUILT AND MERGED, 2026-10-31 — branch `req-268` (`128a5df`…`db0dade`, 9 commits).** · **Lane: bug** · audit 2026-10-30 F-SYNC-1, DEC-128 §2 (newest edit wins), DEC-132, DEC-133 round 5 (`no-base-finished`), DEC-143 ("its on you if you edit on multiplate devies"), DEC-155. Touches `src/sync/merge.js` (shared by server + app) → **reviewer**. No stored record rewritten → no backup reminder.

# req-268 — a workout finished on one device can't come back as in progress after a sync merge

## Reproduction [measured, `main` `78d6bc9`, 2026-10-31]

Probe against the real modules (`src/sync/merge.js` `mergeStates`, `src/workout-log.js` `finishedState`,
`src/state-reducers.js` `startedWorkoutState`/`setLoggedState`, `server/store.mjs` `validState`), seed `src/db.json`.
base = workout `wo-1` in progress, one set logged. Device A finishes it. Device B (same base, not yet pulled) logs one
more set and pushes; the server merges `mergeStates(base, B, A)` as `putState` does (`server/store.mjs:196-199`):

```
1 merged activeWorkout.id: wo-1 | workouts with wo-1: 1 | conflicts: [ 'activeWorkout:edited-on-both' ]
2 after Finish again, ids wo-1 in workouts: 2 | validState accepted: yes
3 next merge: wo-9 kept: true | conflicts: [ 'workouts:edited-on-both (whole array)' ]
4 other direction: wo-9 kept: false | lost in conflict: [ 'edited-on-both id=null' ]
5 validState on a stored state with a duplicate id refuses? no
```

1. The same workout is in progress **and** in history. `activeWorkout` is one record (`merge.js:112-131`); both sides
   changed it, so incoming B wins; `workouts` keeps A's finished `wo-1`.
2. Finishing again stores a second `wo-1` (`finishedState` keeps the id, `workout-log.js:220-245`); `validState` →
   `applyBackup` (`src/exchange.js:579-590`) accepts duplicate ids.
3–4. From then on `idCollection` returns null on the duplicate (`merge.js:29`), so `workouts` merges as **one record**:
   any later both-sides history change loses one side's whole history array — in run 4, a workout finished on B (`wo-9`)
   disappears, kept only as a `lost` value in the server's conflict list.

The same merge runs in the app when it rebases a change made during a sync (`src/sync/engine.js:206`).
`mergeWithoutBase` already has the guard (`merge.js:190-194`, DEC-133 review round 5); the three-way path doesn't.

## Scope

1. **The guard in `mergeStates`**, the same rule as `mergeWithoutBase`: after merging, if `activeWorkout` is in progress
   and its id is in the merged `workouts`, the result's `activeWorkout` is `null` and the dropped one is listed
   (`{ field: 'activeWorkout', id: null, kind: 'finished-elsewhere', lost: <the in-progress workout> }`).
   One shared helper used by both merges (one rule, one place).
2. **A read-only server check** for duplicate workout ids in the latest revision (an `ops` line or a script), so Emilio can
   confirm his data has none. The live DB is not on the planning laptop; this runs on the server.

## Out of scope

- **A validator that refuses duplicate ids.** Rejected: a stored state that already holds a duplicate would make every
  push fail (the server re-validates the merged result, `store.mjs:199`) — sync locked out. Revisit only after step 2
  shows no duplicates exist anywhere.
- **Repairing an existing duplicate** — a stored-data rewrite → ask-gate 2, its own req, only if step 2 finds one.
- Carrying B's late set into the finished workout (inventing a merge of two workouts' sets).
- F-SYNC-2 (whole-state sync size) — BACKLOG §Phase 3.

## Steps

1. Test first (`src/sync/` or `server/merge.test.mjs`): the probe's case 1 as a unit test — fails on main.
2. The shared guard; `mergeWithoutBase` uses it unchanged in behaviour (its existing `no-base-finished` tests stay green,
   kind name kept there).
3. The read-only check + its self-test on a temp DB holding a duplicate.

## Acceptance criteria

1. **Fails on main, passes on the branch:** base/A/B as above → merged `activeWorkout` is `null`, `workouts` has one
   `wo-1` (A's finished record, verbatim), conflicts include `finished-elsewhere` with B's workout as `lost`.
2. **Failure case — no false drop:** an in-progress workout whose id is **not** in history (both devices still mid-workout,
   one logs a set) → unchanged behaviour: incoming wins, `activeWorkout:edited-on-both`, not null.
3. **Failure case — app side:** the engine rebase (`engine.js:206`) with the same three states gives the same null result
   (the app never re-shows a finished workout as in progress).
4. **Right mechanism:** the `lost` value is B's in-progress workout verbatim (assert deep-equal), not a rebuilt one.
5. The read-only check reports `0 duplicate workout ids` on a clean temp DB and names the id on a seeded duplicate; opens
   the DB read-only (a write attempt refused).
6. `./check` green with the full test count; existing `no-base-finished` tests unedited.

## Decisions made on Emilio's behalf

- *(confirmed DEC-155 §8)* B's set logged after A finished is **not** added to the finished workout; it survives only in the
  server's conflict record (as DEC-133 round 5 does for the no-base case; DEC-143 accepts multi-device losses). Emilio
  sees: the workout is finished on both devices; the late set is not in History.
- Implementation: one shared helper; conflict kind `finished-elsewhere` for the three-way path.

## Siblings

req-262 touches `model.js`/`workout-log.js`, not `src/sync/` — no order needed. req-270 (split `workout-log.js`) moves
`finishedState`; whichever lands second updates the import.
