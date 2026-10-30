**Status: BUILT AND MERGED, 2026-10-30 — branch `req-249` (`dd3be0d`…`466e856`, 3 commits).** (into `wf-2026-10-30`) · **Lane: tooling** · DEC-144; workflow audit 2026-10-30 B1, B2, B4. No stored-data change.

# req-249 — three refusals for 10-30's slips: wrong node, wrong machine, behind origin

## The failures, observed (2026-10-30)

1. `./plan publish` → `./check` red, 7 server tests: node 22.14 (nvm default) has no `node:sqlite` `backup`. `NODE_FLOOR`
   is 22.16 (`server/config.mjs:22`), `.nvmrc` 22.23. `check` has no version check (L-065).
2. On job-pro (no server), `./server/deploy` skipped the backup (`server/deploy:15-17` only if `$DATA_DIR/workout.db`) and
   built a stray `~/dev/workout/workout-live` anyway (`:19-39`); a doctor run there printed 9 FAILs that meant "wrong
   machine", recorded as "server down" (`aceaba9`, reverted).
3. Two sessions wrote from the same parent (`aeb887f`/`aceaba9`); `plan save` only warns when behind (`plan:136-156`).

## Scope

1. `check`: first thing, compare `node --version` against `NODE_FLOOR` (read it from `server/config.mjs`, one source —
   req-235) → exit 1: `check: node vX < floor vY — run: nvm use` . Before lint.
2. `server/deploy`, `server/doctor`, `server/ops` (and `restore`, `backup` if they write): refuse when `$DATA_DIR` does not
   exist: `not the server machine (no <DATA_DIR>) — nothing done`, exit 1, before any write/build. Override for a first
   setup: `WORKOUT_FIRST_DEPLOY=1` (deploy only). Put the check in `server/lib.sh` once.
3. `plan save`: when local `planning` is behind `origin/planning` after the fetch → refuse (exit 1) with the same two
   "look first" lines. `plan status`/`next` keep warning only.

## Out of scope

Pinning launchd's node; auto-`nvm use`; any hostname list.

## Acceptance criteria

1. **Failure case:** with node 22.14 first on PATH (`~/.nvm/versions/node/v22.14.0/bin`), `./check; echo $?` → 1, the
   message names both versions, no test ran. On 22.23: green.
2. On this machine (job-pro, no `~/dev/workout/workout-data`): `./server/deploy; echo $?` → 1 with the message, and
   `ls ~/dev/workout` → no such dir afterwards. Same for `./server/doctor`. A test with `DATA_DIR` pointed at a temp dir
   that exists passes the guard (stub the rest).
3. `plan save` in a scratch clone where `origin/planning` is one commit ahead → exit 1, nothing committed; level → commits.
4. `./check` green.
