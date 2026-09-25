# req-170 — a workout's routine falls back to the one its snapshot names

**Status: READY** (2026-09-25) **Lane: data** — migration change: reviewer + a migration test + Emilio's eyes before merge
(he approved the change itself, DEC-090). Source: req-169's review (latent, `model.js:88,161`).

**Reproduce on main first:** a finished workout (and an active one, and a draft) with no top-level `routineId`/`sessionId`
but `snapshot.routineId` (and one with only `snapshot.sessionId`) → after `migrateState` its `routineId` and
`snapshot.routineId` are `undefined`; deleting that routine then hard-deletes it.

**Fix:** in `workoutSnapshot` (`model.js:88`), `routineId = workout.routineId || workout.sessionId ||
workout.snapshot?.routineId || workout.snapshot?.sessionId`. Top-level still wins when both exist (the reviewer measured
that main already prefers it — keep that). Nothing is removed from any record.

## Acceptance criteria

- A migration test per shape (finished / active / draft × snapshot.routineId / snapshot.sessionId): red on main (`undefined`),
  green on the branch (the routine id restored); the top-level-wins case unchanged.
- **Old keys survive:** the req-164 golden (v8 db.json + the old docs) still deep-equals main — i.e. no change for data the
  app wrote (paste). State the count of records whose `routineId` changes in db.json: expected 0.
- Deleting the routine in the snapshot-only case now archives it (a test, and a browser run via `./plan qa --seed`).
- `./check --smoke` green (paste). Reviewer before merge; Planner asks Emilio before merge (data lane).
