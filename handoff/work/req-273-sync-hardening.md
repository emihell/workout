**Status: READY** · **Lane: bug** · DEC-133 (restore keeps the live workout), DEC-155 §8–9 (no silent loss), DEC-143, req-268 review latents. Touches `src/sync/` → independent reviewer (WORKFLOW check 5). No stored record rewritten → no backup reminder.

# req-273 — sync can't get stuck on a refused conflict list; a restore merge never ends a live workout

Source: req-268 re-review (BACKLOG §Tooling "req-268 review latents"). All three reproduced on `main` `5798ae2`
(probes in Planner's scratchpad `r273/`, run with `node <probe> <repo>`).

## Reproduction

**1. A refused `conflicts` list blocks every later push.** The engine sends `pendingConflicts` with every PUT
(`src/sync/engine.js:328-335`) and clears them only after a 2xx (`:354`). A 4xx goes through `settle` → `error`, return
(`:210-213`), so the list stays and the next push carries it again. The server refuses a bad shape with 400
(`server/store.mjs:164-178` `deviceConflicts`). Fake server: GET 200, PUT 400 with that message; meta holds 1 pending
conflict; 6 syncs:

```
puts 6 with conflicts 6 | pending left 1 | error {"kind":"server","message":"conflicts must be a list of {field, id, kind, lost}."}
```

No state change reaches the server while this lasts. It only goes away on a first login as another user (`engine.js:469`).
Masked today: `deviceConflicts` accepts exactly what `merge.js` emits — so a future change to either shape, or a newer
app against an older/stricter server, is what trips it.

**2. The no-base merge after a restore ends the server's live workout.** `mergeWithoutBase` (`src/sync/merge.js:203-222`)
calls `dropFinished(out, conflicts, 'no-base-finished')` with no `other` (`:220`); `mergeStates` passes one (`:134`, req-268
review fix). Device: stale wo-2 in progress + wo-2 finished in history; server: wo-new live:

```
restored=false active: wo-new [ 'no-base-differs:wo-2' ]
restored=true  active: null   [ 'no-base-in-progress:wo-new', 'no-base-finished:wo-2' ]
```

With `restored: true`, `noBase` keeps the device's wo-2 (`merge.js:190-192`), `dropFinished` drops it as finished → `null`;
the server's wo-new survives only as a conflict record. Masked by `activeIsRestoredCopy` (`server/store.mjs:260-273`):
`restored` holds only while the server's workout is still the restored copy, which a wo-new started after the restore is
not — so it needs a backup that already holds wo-2 finished and wo-new live.

**3. `./server/ops duplicates` leaves `-wal`/`-shm` beside a closed WAL database.** `readOnlyDb`
(`server/ops.mjs:186`) opens `{ readOnly: true }`. On a closed WAL DB (temp copy):

```
closed: t.db
after readOnly open: t.db t.db-shm t.db-wal
after immutable URI (file:…?immutable=1, readOnly): t.db         ← count read correctly, no sidecars
```

`immutable=1` must NOT be used while the server has the DB open: it ignores the WAL, so the newest revisions (still in
`-wal`) would be missed (the req-268 reviewer measured the check reading them from the WAL with the server running).

## Scope

1. **Refused conflicts are dropped, not retried forever.** The server's 400 for a bad `conflicts` shape carries a
   machine-readable marker (e.g. `{ error, code: 'bad-conflicts' }`, `store.mjs:178`). On a PUT answered 400 with that
   code, the engine clears the `pendingConflicts` it sent (only those; any added since stay), records why
   (`console.warn` with the count and the server's message — the engine has no log of its own [inferred]), and pushes again at once
   **without** them, so the state itself reaches the server. Any other 4xx keeps today's behaviour.
2. **`mergeWithoutBase` passes `other`** to `dropFinished`, as `mergeStates` does: the side whose `activeWorkout` the merge
   didn't keep. A live workout on the other side that isn't in the merged history is kept instead of `null`; the conflict
   that listed it as lost is removed by `dropFinished`'s existing rule (`merge.js:154-157`); the dropped stale copy is
   still recorded as `no-base-finished`.
3. **`ops duplicates` leaves no sidecars on a closed DB:** open with `file:<path>?immutable=1` (readOnly) only when no
   `<db>-wal` file exists (no writer has it open in WAL mode); otherwise exactly as today. Same for any other read-only
   ops reader that uses `readOnlyDb`.

## Out of scope

- Repairing stored data, changing what a merge keeps in any other case, the conflict record's shape.
- F-SYNC-2 (whole-state sync growth; stage 2).

## Steps

1. Tests for 1–3 that fail on main (engine harness `src/sync/engine.test.js` `deviceFetch` for 1; `merge.test`/
   `server/req-268.test.mjs` style for 2; a temp WAL DB for 3).
2. Implement 1, 2, 3.
3. Re-run req-268's tests and the round-5 `no-base-finished` tests unedited.

## Acceptance criteria

1. **Fails on main, passes on the branch — stuck sync:** fake server answers PUT-with-conflicts 400 `bad-conflicts`, PUT
   without conflicts 200. After one sync: pending list empty, one warn line, the state is on the server (rev +1), no
   `error` left. On main: probe output above.
2. **Failure case — other 4xx unchanged:** a 400 without the code (or a 403) keeps the list pending and sets `error` as
   today (no drop, no extra push).
3. **Failure case — conflicts added mid-flight survive:** a conflict queued after the refused push was sent is still
   pending after the drop and goes up with the next push.
4. **Restore merge keeps the live workout:** the probe's `restored=true` case → `activeWorkout` wo-new, conflicts exactly
   `[no-base-finished: wo-2]`; `restored=false` unchanged. Fails on main.
5. **No false keep:** when the other side's workout IS in the merged history (finished there too) → `null` as today.
6. **ops duplicates:** on a closed WAL DB no `-wal`/`-shm` appear and the count is right; with a writer open (WAL present)
   it reads the newest revision from the WAL (a revision written after the writer's last checkpoint is counted).
7. `./check` green (count stated), smoke green; existing sync tests unedited.

## Decisions made on Emilio's behalf

- implementation: the `code` field name; the warn text; reopening via immutable only when no `-wal` exists.
- behaviour (invisible in the app): a conflict record the server refused is dropped after one try rather than blocking
  sync — the record is lost, the state is not. DEC-155 §9's "never lost silently" holds for data the server accepts;
  a refused record is warned in the console. (confirmed DEC-155 §10)

## Siblings

req-268 (merged) built the pieces this hardens. No open req touches `src/sync/` or `server/ops.mjs`.
