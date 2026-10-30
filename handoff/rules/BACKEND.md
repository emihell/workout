# Backend rules (DEC-085 §7, written 2026-10-21 before any server code)

The backend lane's "Ready when" (WORKFLOW §Requirement lanes). Pattern borrowed from White Sleeve (`~/dev/white-sleeve`,
read-only, DEC-128 §3) and adjusted to this app. Owns: what may touch the live server and its data.

## Where things live

| What | Where | In git? |
|---|---|---|
| server code | `server/` in the repo | yes |
| live code | `~/dev/workout/workout-live/` — a `git archive main` copy made by `./server/deploy` | no |
| live database | `~/dev/workout/workout-data/workout.db` (+ `backups/`) — **outside every worktree** | **never** |
| secrets (session key) | `~/dev/workout/workout-data/secret` — made on first start, mode 600 | **never** |

Reason for the split: Builder checks out branches in `workout-codebase`; a server run from there would change code under the
live data. Live runs only from a `main` copy; data sits beside the worktrees like White Sleeve's `data/`.

## The rules

1. **Secrets out of git.** No password, key, token or `.env` in the repo; `.env*`, `*.db` and `*.db-*` are in `.gitignore` (added by req-229; they were missing). A test
   asserts the server refuses to start with its secret inside the repo tree.
2. **Who runs the server.** Emilio, on the server machine, from the line `plan closeout` prints after any change the server
   serves (L-063, DEC-144 §3); Planner records "deployed" only from `./server/doctor`'s output. Build agents **never** start,
   stop or point anything at the live server or DB — they use a throwaway instance on a temp DB and a free port (staging ≠ prod).
3. **Bound to 127.0.0.1, tailnet-only.** Reached through `tailscale serve` HTTPS; `tailscale funnel` stays **off**. A check
   (`./server/doctor`) prints the bind address and funnel state.
4. **Ask-gate 3 — anything that reaches other people.** Funnel / public hosting, inviting a user, sending anything off this
   Mac (email, a cloud backup) → ask Emilio first, every time. Joins BUILDER.md's gates 1 and 2.
5. **The live DB is the user's history (BUILDER.md gate 2 applies).** Written only by the server's normal request path.
   Anything else that writes it — a script, a migration, a repair — takes a backup first (`./server/backup <reason>`) and
   asks Emilio with the record counts.
6. **Backups.** Before any non-request write (rule 5), before each deploy, and weekly (keep the last 4; DEC-136). SQLite's online
   backup API, integrity-checked, never a plain `cp` (White Sleeve L: a `cp` misses rows still in the `-wal` file).
7. **Restore drill.** Before go-live and after any server schema change: restore the newest backup into a throwaway instance,
   log in, and compare record counts with the live DB. The receipt goes in the req's report.
8. **Tests never reach the live DB or the network.** The server suite runs on temp DBs; a guard fails the suite if the live
   data path is opened.
9. **The server never invents data either** (DESIGN §1, DEC-096). It stores, merges and returns what the app sent; it
   computes nothing the user sees.
10. **Export and Import stay** in the app, unchanged, at every stage (DEC-127).
