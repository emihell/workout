**Status: READY** · **Lane: tooling** · server ops (req-231 follow-up). Server files only; no app code, no stored records.

# req-237 — doctor checks the *nightly* backup; a missed 01:00 catches up within the hour

Emilio, 2026-10-26: "server doctor must check the newest *nightly* backup + launchd run count, not any backup;
consider a fallback backup when launchd misses a night."

## The failure, observed

- 2026-10-26 01:00 the nightly did not run. Mac awake: `pmset -g log` shows no Sleep/Wake event between the
  10-25 deploy and `2026-10-26 05:57 Display is turned on`. `launchctl print … com.workout.server.nightly` → `runs = 0`
  at ~06:00. Cause unknown. Manual `launchctl kickstart` → `workout-20261026-060154-nightly.db`, exit 0
  (`logs/nightly.log`: `… integrity ok; kept 1, deleted none`). Now `runs = 1`, `last exit code = 0` (06:38).
- The doctor said ok: it ages the newest backup of **any** reason (`server/ops-cli.mjs:168-173`,
  `ops.listBackups(...)[0]`, `BACKUP_MAX_HOURS = 26` at `:20`). The newest was
  `workout-20261025-221100-deploy-4ec8287.db` (deploy backup, `server/deploy:16`), so a missing nightly is invisible
  for up to 26 h after any deploy, and forever if deploys are frequent.
- `runs` resets on every deploy: `server/deploy:32-35` runs `server/stop`, which `launchctl bootout`s both agents
  (`server/stop:9-10`), and start bootstraps them again (`server/start:71-72`). The 10-25 22:11 deploy did exactly
  that, 3 h before the missed 01:00. So `runs` is "since the last deploy", not "per night" — usable as information,
  not as a pass/fail on its own.
- The agent: `StartCalendarInterval` Hour 1 Minute 0 (`server/start:63-64`), runs
  `ops-cli.mjs backup --nightly` → `ops.nightly()` (`server/ops.mjs:119-128`): backup, then keep the newest 7
  nightlies (`NIGHTLY_KEEP`, `:18`); a nightly is `reason === 'nightly'` or `/^nightly-\d+$/` (`:17`, `:20`).

## Scope

1. **Doctor: the nightly check.** Replace the any-backup check with: the newest **nightly** backup
   (reason per `ops.mjs:17/:20`) exists and is ≤ `BACKUP_MAX_HOURS` old → `ok`, else `FAIL` naming the file and age
   (or "none"). Keep the newest-of-any-reason as an info line (not a check).
2. **Doctor: launchd detail.** On darwin, parse `launchctl print gui/<uid>/<label>.nightly` for `runs` and
   `last exit code`; print them on the nightly agent's line. `FAIL` if the last exit code is present and non-zero.
   `runs` is information only (resets on deploy, above). The parser is a pure function in `ops.mjs` with a fixture
   test, like `serveState` (`server/ops.test.mjs:323`).
3. **Fallback — catch up within the hour.** The nightly agent runs **hourly** (`StartInterval 3600`) and at load
   (`RunAtLoad`), calling `backup --nightly --if-due`: it makes the nightly only when it is past 01:00 local and no
   nightly is stamped today; otherwise it exits 0 silently. A missed 01:00 (whatever the cause) lands by ~02:00; a
   Mac off or asleep all night gets it at wake or the first hour after. `backup --nightly` without `--if-due` keeps
   today's behaviour (always makes one) for by-hand use.
4. `server/start`'s `say` line and header comment (`:2-3`, `:76`) describe the new schedule.

## Out of scope

- Finding why launchd skipped 10-26 01:00 — the fallback makes the cause non-fatal; if `nightly.log` shows a
  catch-up at 02:00 often, that's a new req.
- The off-Mac copy (NOW: Emilio's call, iCloud / external / Time Machine).
- Alerting (a notification when doctor fails). Doctor stays run-by-hand.
- Rotation changes: still 7 nightlies.

## Acceptance criteria

1. **Failure case — the gap that hid 10-26:** a throwaway data dir with a fresh *deploy* backup (1 h old) and a
   nightly 30 h old → doctor FAILs on the nightly line, exit 1. Same dir with no nightly at all → FAIL "none". Paste both.
2. Fresh nightly (2 h old) → that line ok.
3. `--if-due`, with `at` injected (`ops.nightly` already takes `at`, `:119`): 00:30 with no nightly today → none
   made; 02:00 with no nightly today → one made; 02:00 again → none made (only one per day); 03:00 the next day → one
   made. Unit test, temp dirs only.
4. launchctl parser: fixture with `runs = 0` and no exit code → no FAIL; `last exit code = 1` → FAIL; the real output
   on this Mac → `runs`/`exit` read correctly (paste the doctor line).
5. **Planner after deploy (the self-test that it fires):** `./server/deploy`, then `plutil -p
   ~/Library/LaunchAgents/com.workout.server.nightly.plist` shows `StartInterval => 3600` and `RunAtLoad => true`;
   `./server/doctor` output pasted; the next morning `nightly.log` has exactly one new nightly line for the date.
6. `./check` green.

## Decisions made on Emilio's behalf

- implementation: hourly-plus-if-due over a second calendar time — a second fixed time can be skipped the same way;
  hourly recovers whatever the cause. Silent when not due (24 log lines a day otherwise).
- implementation: `runs` printed, not checked (it resets on each deploy).
- No behaviour a user sees in the app. Emilio's steps don't change.

## Siblings

- Order: independent of req-236 / req-238. Touches `server/ops-cli.mjs`, `server/ops.mjs`, `server/start`; nothing else
  open touches them. No reviewer trigger file (`store.jsx`/`model.js`/`storage.js`/…); no stored records written.
