# req-37 — v5 migration round-trip test (audit F-RISK-1)

Branch `req-37`. **Test-only, no production code change.** Functional gate (planning
merges). Not merged.

## Technical

Added `describe('req-37 v5 migration round-trip', …)` to `src/storage.test.js`,
modeled on the v6 test (`:107-158`). Seeds `workout-mvp-v5` with `schemaVersion: 5`
and a program-wrapped shape that also carries the legacy fields the v6/v7 tests skip
(the v6 test has empty `workouts` and no `plannedWorkouts`):

- `programs[].sessions` with `sess-1` (flatten path) + an exercise.
- `schedule.slots: [{ …, programId, sessionId: 'sess-1' }]`.
- a **workout** with legacy `sessionId: 'sess-1'` + `snapshot` (its own `sessionId`/
  `sessionName`/`programName`) + logged `sets` with `sessionItemId` — exercises
  `workoutSnapshot` + `stripLegacyWorkoutKeys`.
- a **plannedWorkout** with plan-level `sessionId: 'sess-1'`.

Asserts the round-trip to v8:
- routine flatten: `routines[0].id === 'sess-1'`, name/focus preserved; `programs`/
  `sessions` `undefined`.
- **slot** `routineId === 'sess-1'`, no `sessionId`.
- **workout** `routineId === 'sess-1'`, `sessionId` stripped; snapshot migrated
  (`snapshot.routineId === 'sess-1'`, own `sessionId` dropped, `programName` kept);
  snapshot item + set `sessionItemId → routineItemId` (legacy id remap), `sessionItemId`
  gone.
- **plan** `routineId === 'sess-1'`, no `sessionId`.
- `workout-mvp-v8` written, parses, `schemaVersion === 8`, `programs === undefined`.

### The real prize — a branch asymmetry the seed surfaced
`migrateState` has **two** workout-migration paths in `workoutSnapshot` (`model.js`),
and they treat workout-level `programName` differently:

- **snapshot-present branch** (`model.js:~90-135`): the migrated snapshot is
  `{ ...workout.snapshot, … }` — `programName` survives **only if it was inside
  `workout.snapshot`**. Workout-level `workout.programName` is **not** read here.
- **snapshot-less branch** (`model.js:~180-190`): sets
  `programName: workout.programName || workout.snapshot?.programName || legacyProgram.programName`
  — this is the path `reference/schema.md` cites for "legacy `programName` preserved
  onto the snapshot."

Net: a legacy workout that has a top-level `programName` **but also a snapshot** loses
that top-level `programName` — only `snapshot.programName` carries through. It's not a
bug for real data (finished workouts always have a snapshot that itself holds
`programName`), but it means the schema.md line reads as more general than the code is.
Because the spec directed a snapshot-bearing workout, the test puts `programName: 'Gym'`
**in the snapshot** and asserts it round-trips there. Flagging for schema.md: the
"programName preserved" note applies to the snapshot-less branch; the snapshot branch
preserves only `snapshot.programName`. **Candidate for a one-line schema.md clarification
— planning's call (I can't edit handoff/).**

### Implementation choices (spec left these to CC)
- Exact seed values (`sess-1`, `ex-1`, `Gym`, `si-old-1`, dates) and assertion phrasing.
- Added assertions beyond the spec list: `snapshot.programName` survival and the
  `sessionItemId → routineItemId` remap on both the snapshot item and the set — legacy
  id paths no existing test covers.

### Verification
`./check` — green, test count 149 → 150:
```
# pass 150 # fail 0
check: green — lint, 14 test file(s), and the build all passed.
```
New describe green:
```
# Subtest: req-37 v5 migration round-trip
    ok 1 - reads the v5 key, flattens programs, maps every sessionId→routineId, writes v8
ok 4 - req-37 v5 migration round-trip
```
Diff touches only the test file:
```
 src/storage.test.js | 90 +++++++++++++++++++++++++++++++++++++++++++++++++++++
 1 file changed, 90 insertions(+)
```

Acceptance criteria: v5 test passes asserting flatten + `sessionId→routineId` on
**slot, workout, and plan** + program drop + id preservation ✅; `./check` green, count
rose ✅; only `src/storage.test.js` changed ✅.

## Workflow

- Built to spec, test-only. No production code touched.
- **Finding surfaced** (the spec's stated "real prize"): the workout-level vs.
  snapshot-level `programName` branch asymmetry above. It doesn't change behaviour but
  the `reference/schema.md` "programName preserved onto the snapshot (`:183`)" line is
  branch-specific — worth a one-line clarification there. I can't edit `handoff/`;
  surfacing it here for planning.
- No decisions needed from Emilio; functional gate, no persisted-data change.
</content>
