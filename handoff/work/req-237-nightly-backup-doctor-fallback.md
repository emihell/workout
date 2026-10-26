**Status: BUILT AND MERGED, 2026-10-26 — branch `req-237` (`a4c9626`…`97a67eb`, 2 commits).** · **Lane: tooling** · server ops (req-231 follow-up). Server files only; no app code, no stored records.

# req-237 — the scheduled backup goes weekly, catches up within the hour, and doctor checks it

Emilio, 2026-10-26: "server doctor must check the newest *nightly* backup + launchd run count, not any backup;
consider a fallback backup when launchd misses a night." Then: "we dont need a backup . every night, once a week is
fine now" → **DEC-136** (weekly, keep 4; amends BACKEND rule 6). File name kept from the first draft.

## The failure, observed

- 2026-10-26 01:00 the nightly did not run. Mac awake: `pmset -g log` shows no Sleep/Wake event between the
  10-25 deploy and `2026-10-26 05:57 Display is turned on`. `launchctl print … com.workout.server.nightly` → `runs = 0`
  at ~06:00. Cause unknown. Manual `launchctl kickstart` → `workout-20261026-060154-nightly.db`, exit 0
  (`logs/nightly.log`: `… integrity ok; kept 1, deleted none`). Now `runs = 1`, `last exit code = 0` (06:38).
- The doctor said ok: it ages the newest backup of **any** reason (`server/ops-cli.mjs:168-173`,
  `ops.listBackups(...)[0]`, `BACKUP_MAX_HOURS = 26` at `:20`). The newest was
  `workout-20261025-221100-deploy-4ec8287.db` (deploy backup, `server/deploy:16`), so a missing scheduled backup is
  invisible for as long as deploys keep happening.
- `runs` resets on every deploy: `server/deploy:32-35` runs `server/stop`, which `launchctl bootout`s both agents
  (`server/stop:9-10`), and start bootstraps them again (`server/start:71-72`). So `runs` is "since the last deploy" —
  information, not a pass/fail.
- Today's agent: `<label>.nightly`, `StartCalendarInterval` Hour 1 Minute 0 (`server/start:54-66`), runs
  `ops-cli.mjs backup --nightly` (`ops-cli.mjs:73-76`) → `ops.nightly()` (`server/ops.mjs:119-128`): backup, then keep
  the newest 7 (`NIGHTLY_KEEP`, `:18`); a scheduled backup is reason `nightly` or `/^nightly-\d+$/` (`:17`, `:20`);
  the reason is reserved (`:89-90`). 29 `nightly` mentions across `server/` (non-test) — `grep -n nightly server/*`.

## Scope

1. **Weekly (DEC-136).** Rename the scheduled backup to *weekly* end to end: reason `weekly` (reserved like `nightly`
   today), CLI `backup --weekly`, `ops.weekly()`, `WEEKLY_KEEP = 4`, agent `<label>.weekly`, log `logs/weekly.log`.
   Rotation keeps the newest 4 of `weekly` **and** legacy `nightly` backups together, so the existing nightly file
   rotates out instead of staying forever. Deploy/by-hand/pre-restore backups are never rotated (as today).
2. **Catch-up.** The agent runs **hourly** (`StartInterval 3600`) and at load (`RunAtLoad`), calling
   `backup --weekly --if-due`: it makes one only when the newest weekly-or-legacy-nightly is ≥ 7 days old (or there is
   none); otherwise it exits 0 silently. A missed run, a Mac asleep or off, lands within the hour after it's back.
   `backup --weekly` without `--if-due` always makes one (by hand).
3. **The old agent goes.** `server/start` and `server/stop` bootout `<label>.nightly` if loaded and remove its plist,
   so a deploy leaves exactly one scheduled agent.
4. **Doctor.** Replace the any-backup check with: newest weekly-or-legacy-nightly exists and is ≤ 8 days old
   (7 days + 1 day slack) → `ok`, else `FAIL` naming the file and age (or "none"). Newest-of-any-reason stays as an
   info line. On darwin: `<label>.weekly` loaded (check), `<label>.nightly` **not** loaded (check), and from
   `launchctl print` the `runs` (info) and `last exit code` (`FAIL` if present and non-zero). The parser is a pure
   function in `ops.mjs` with a fixture test, like `serveState` (`server/ops.test.mjs:323`).
5. `server/start`'s header and `say` line (`:2-3`, `:76`), `server/README.md`, `ops-cli.mjs:3,7` usage text: weekly.

## Out of scope

- Why launchd skipped 10-26 01:00 — the catch-up makes the cause non-fatal.
- The off-Mac copy (NOW: Emilio's call). Alerting when doctor fails.
- Renaming or deleting existing backup files by hand.

## Acceptance criteria

1. **Failure case — the gap that hid 10-26:** throwaway data dir with a fresh *deploy* backup (1 h old) and a weekly
   9 days old → doctor FAILs on the scheduled-backup line, exit 1. Same dir with none → FAIL "none". Paste both.
2. A weekly 6 days old → ok; a legacy `…-nightly.db` 2 days old and no weekly → ok (it counts).
3. `--if-due`, with `at` injected: newest 6 days 23 h old → none made; 7 days → one made; run again at once → none
   made; none at all → one made. Rotation: 5 weekly/nightly + 2 deploy backups → newest 4 scheduled + both deploy
   backups remain. Unit tests, temp dirs only.
4. `backup weekly` (the reason, by hand) is refused like `backup nightly` is today (`ops.mjs:89-90`).
5. launchctl parser: fixture with `runs = 0`, no exit code → no FAIL; `last exit code = 1` → FAIL.
6. **Planner after deploy (the self-test that it fires):** `./server/deploy`; `launchctl print gui/$(id -u)/com.workout.server.nightly`
   → not found; `plutil -p ~/Library/LaunchAgents/com.workout.server.weekly.plist` → `StartInterval => 3600`,
   `RunAtLoad => true`; no `…nightly.plist` left; `./server/doctor` → all ok, pasted. On 2026-11-02 (7 days after the
   10-26 nightly) `weekly.log` shows one new backup.
7. `./check` green.

## Decisions made on Emilio's behalf

- Keep 4 weeklies (~a month); legacy nightly counts toward the 4 — DEC-136, reversible.
- implementation: hourly-plus-if-due over a fixed weekday/time — a fixed time can be skipped the way 10-26 01:00 was;
  "due" = 7 days after the newest, so the day drifts by up to an hour a week. Silent when not due.
- implementation: `runs` printed, not checked (resets on deploy). Doctor slack 8 days.
- No behaviour a user sees in the app; Emilio's steps don't change.

## Siblings

- Independent of req-236 / req-238. Touches `server/ops.mjs`, `ops-cli.mjs`, `start`, `stop`, `README.md`,
  `ops.test.mjs`; nothing else open touches them. No reviewer trigger file; no stored records written.
- After closeout Planner updates NOW ("nightly" → weekly).
