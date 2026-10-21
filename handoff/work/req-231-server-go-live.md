**Status: BLOCKED ON req-229, req-230** **Lane: data** (Emilio's eyes before go-live) · req-146 stage 1, part 3 of 3

# req-231 — go live: the server on this Mac, your data on it

DEC-127/128/129, `rules/BACKEND.md`. Runbook + small scripts; Builder writes the scripts, **Planner runs the go-live with
Emilio** (BACKEND rule 2).

## Scope

1. Scripts in `server/`: `deploy` (`git archive main` → `~/dev/workout/workout-live/`, build, restart), `start`/`stop`
   (refuse from anywhere but the live copy, like White Sleeve's), `backup <reason>` (SQLite online backup, integrity-checked),
   nightly backup keeping 7, `restore <backup> --to <temp dir>`, `doctor` (bind address, funnel off, data path outside the repo,
   last backup age).
2. Keep it running: starts at login (launchd agent), restarts if it dies. [Planner's call, implementation]
3. `tailscale serve --bg --https=8446 http://127.0.0.1:8100`; `:443` stays the previews' (req-229 facts).
4. **Go-live, with Emilio:** bootstrap his account → fresh Export from his phone (the Pages site) → Import on the server build
   on his phone (the req-220 preview shows counts) → compare counts on both sides → he logs a workout through it.
5. **Restore drill** (BACKEND rule 7) before step 4; receipt in the report.

## From req-229's review (latent, verify here)

- **Cookies don't isolate by port:** `tailscale serve` puts :443 / :8443 (White Sleeve) / :8444 / :8445 on the same host as
  :8446, and the browser sends `workout_session` to all of them; another service could set one with a more specific path.
  Decide the mitigation (e.g. a distinct cookie name + `Path=/` and reading only ours, or a separate hostname) and test it.
- **Same-origin check behind `tailscale serve`:** verify what Host / X-Forwarded-Host arrive; if Host is rewritten to
  `127.0.0.1:8100`, every write would 403. Receipt: a real login + PUT through `:8446`.

## Out of scope

Other users, invites, public hosting (ask-gate 3). Closing the Pages site (DEC-129: after the server has carried real
workouts — its own req).

## Acceptance criteria

1. `doctor` → bind `127.0.0.1:8100`, funnel off, data dir outside every worktree. Paste it.
2. **Failure — server down:** kill it → launchd restarts it within a minute; meanwhile the phone logs offline and syncs after.
3. Restore drill: newest backup → throwaway instance → login → counts equal live. Paste the counts.
4. Go-live counts: exercises / routines / workouts on the Pages phone = on the server after Import (Emilio confirms).
5. Nightly backup present the next morning.

## Decisions made on Emilio's behalf

- **implementation:** paths and port above; launchd; backups kept 7.
- Emilio's: the go-live itself (his data moves) — asked at the time, with the counts.
