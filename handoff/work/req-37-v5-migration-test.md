# req-37 — a v5 migration round-trip test (audit F-RISK-1)

**Status: READY.** Test-only, no production code change. From audit 2026-09-12
(F-RISK-1). **Gate: functional** — no schema/data change, so planning verifies
(`./check`) and merges; no Emilio-hands gate (DEC-009 covers *changes* to
persisted data; this adds a test that only reads migration behaviour).

## Why

`workout-mvp-v5` is a claimed-supported legacy key (`storage.js:5` `LEGACY_KEYS`;
`SHIPPED.md`: "`loadState` migrated `v7/v6/v5` → `v8`"), but it has **no
round-trip test**: v6 is covered (`storage.test.js:107-158`), v7 is covered
(`:164-227`), v5 has only a *delete*-assertion (`:182`). CLAUDE.md's migration
ask-gate wants "a migration test that proves an older key survives the upgrade"
for each supported version. [measured, audit F-RISK-1]

**Reconstruction finding:** there is **no distinct v5 on-disk shape in this repo's
git history** — the schema-version scheme predates the current history and
`migrateState` is **uniform / shape-driven** (no per-version branch, `model.js:219`).
So "v5" is a *version number* the code accepts on a legacy (program-wrapped) shape,
not a separate transform. The test's value is therefore two things: (1) prove the
`v5` **key** is read and round-trips, and (2) cover the legacy paths the v6/v7
tests **don't** — specifically **workout-level `sessionId`/`programName`** and
**plan `sessionId`** (the v6 test has empty `workouts`, no `plannedWorkouts`).

## Scope

- Add a `v5` round-trip test to `src/storage.test.js`, modeled on the v6 test
  (`:107-158`), seeding `workout-mvp-v5` with `schemaVersion: 5` and a
  **program-wrapped** shape that also includes the legacy fields the existing
  migration tests miss (below).
- No change to `storage.js`, `model.js`, `SCHEMA_VERSION`, or any production code —
  this is pure coverage of existing behaviour.

## What the v5 seed must include (to cover the gaps)

Seed `workout-mvp-v5` with `schemaVersion: 5` and:
- `programs: [{ id, name, sessions: [{ id: 'sess-1', name, focus, exercises: [...] }] }]`
  — the program-wrapped shape (flatten path).
- `schedule.slots: [{ week, weekday, programId, sessionId: 'sess-1' }]` — slot
  `sessionId` → `routineId`.
- **`workouts: [{ ... sessionId: 'sess-1', programName: 'Gym', snapshot: {...},
  sets: [...] }]`** — the legacy workout shape the v6/v7 tests skip; exercises the
  `workoutSnapshot` + `stripLegacyWorkoutKeys` path (`model.js:72,110,205-208`).
- **`plannedWorkouts: [{ ... sessionId: 'sess-1' }]`** — exercises the plan
  `sessionId` → `routineId` map (`model.js:247-250`).
- An opaque id (`sess-1`) to prove ids are kept.

## Ordered steps

1. Add `describe('req-37 v5 migration', …)` to `storage.test.js` seeding the above
   via the existing `withLocalStorage({ seed: { 'workout-mvp-v5': … } }, …)` helper.
2. Assert the round-trip to v8:
   - `state.routines[0].id === 'sess-1'`, `.name`/`.focus` preserved; `state.programs`
     and `state.sessions` are `undefined` (flattened/dropped).
   - the schedule slot's `routineId === 'sess-1'` and it carries **no** `sessionId`.
   - the workout migrated: its `routineId === 'sess-1'`, **no** `sessionId` on it
     (stripped), and its snapshot is intact.
   - the planned workout's `routineId === 'sess-1'`.
   - `map.get('workout-mvp-v8')` is written and parses; `stored.programs === undefined`.
3. Confirm the existing v6/v7/req-06 tests still pass (no seam changes).

## Acceptance criteria (written before implementation)

- The new v5 test passes and asserts routine flatten + `sessionId`→`routineId` on
  **slot, workout, and plan** + program drop + id preservation. Command: `node --test`
  output pasted, showing the new describe green.
- `./check` green — paste the line. Test count rises (149 → 150+).
- No production file changed — the diff touches only `src/storage.test.js`. Confirm
  in the report (a `git diff --stat` showing one file).

## Decisions

- **classification:** test-only, functional gate (planning merges). No new behaviour.
- **implementation (CC's call):** exact seed field values and assertion phrasing.

## Notes

`reference/schema.md` records the "no distinct v5 shape in git; migration is
uniform" finding (planning updated it alongside this req). If, while writing the
seed, you find a legacy field the migration handles that none of the tests cover,
add an assertion for it and note it in the report — that's the real prize here.
