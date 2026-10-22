# The server — runbook (req-231)

Rules: `handoff/rules/BACKEND.md`. Planner runs the live server; Builder and agents only ever use a
throwaway instance (set `WORKOUT_LIVE_DIR`, `WORKOUT_DATA_DIR`, `WORKOUT_PORT`, `WORKOUT_LABEL` —
`server/lib.sh` lists them).

| Where | What |
|---|---|
| `~/dev/workout/workout-live/` | the running code: `git archive main` + `dist-server/`, `DEPLOYED` says which commit |
| `~/dev/workout/workout-data/` | `workout.db`, `secret`, `backups/`, `logs/` (server.log, nightly.log) |
| `~/Library/LaunchAgents/com.workout.server{,.nightly}.plist` | written by `start`, removed by `stop` |
| `https://<this mac>.ts.net:8446` | `tailscale serve --bg --https=8446 http://127.0.0.1:8100` (tailnet only; `:443` is the previews') |

| Command | Run from | Does |
|---|---|---|
| `./server/deploy` | a worktree | backup `deploy-<sha>` → archive `main` → build → swap in (old copy kept as `workout-live.prev`) → restart if it was running |
| `server/start`, `server/stop` | the live copy only | launchd agent: at login, restarted if it dies, nightly backup 01:00 keeping 7; `stop` keeps it off |
| `server/backup <reason>` | anywhere | online SQLite backup, integrity-checked, safe while running |
| `server/restore <backup> --to <dir>` | anywhere | the restore drill: a throwaway data dir, live untouched |
| `server/restore <backup> [--yes]` | anywhere, server stopped | into the data dir: shows both counts, needs `--yes`, backs up `pre-restore`, writes the `restores` marker (DEC-133) |
| `server/doctor` | anywhere | bind 127.0.0.1, health, :8446 mapping, funnel off, data dir outside every worktree, modes, agents, last backup ≤ 26 h |
| `node server/ops-cli.mjs counts [db]` | anywhere | record counts per table and per user |

## Restore drill (BACKEND rule 7)

```
server/backup drill
server/restore <newest backup> --to /tmp/drill-x
WORKOUT_DATA_DIR=/tmp/drill-x WORKOUT_PORT=8101 WORKOUT_APP_DIR=~/dev/workout/workout-live/dist-server node server/start.mjs
# log in on 8101, compare with `node server/ops-cli.mjs counts` on the live DB; stop it; rm -rf /tmp/drill-x
```

## Go-live: a phone that has used a server build before

Clear the server origin's **website data** on the phone (all of it, not only `workout-sync-v1`), then
log in, then Import with **Replace everything**. Why (`src/sync/engine.test.js`, req-231 block):
- a stale `workout-sync-v1` → the no-base merge **adds** the test records (rev ids don't stop it);
- only `workout-sync-v1` cleared → first login onto the empty account uploads the test data as rev 1,
  and its feedback notes go up too;
- "Keep my history" keeps the *device's* finished workouts, not the file's — on a cleared phone it
  imports no workouts.
