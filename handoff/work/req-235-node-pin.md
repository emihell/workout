**Status: READY** **Lane: tooling** · server stage 1 ops (req-231 follow-up)

# req-235 — one Node floor, pinned, and doctor checks the Node launchd runs

Emilio, 2026-10-25 ("3. do it"): the Node pin from req-231's report.

## Facts (rescanned 2026-10-25)

- There are two floors.
  - `NODE_FLOOR = [22, 13, 0]` (`server/config.mjs:20`) is used by `start.mjs:11` and `accounts.mjs:55`.
  - A hard-coded "≥ 22.16" (`node:sqlite` backup) appears in `server/start:12-13` and `server/ops-cli.mjs:23`.
- `.nvmrc` is `22`. `package.json` has no `engines`.
- The launchd plist bakes in an nvm path: `/Users/emilio/.nvm/versions/node/v26.8.2/bin/node`. That comes from
  `server/start:10`, `command -v node`. nvm has v22.23.3 and v26.8.2. There is no system or Homebrew node [measured: `plutil -p`,
  `ls`]. So an `nvm uninstall 26.8.2` leaves the agent pointing at a missing binary, and launchd's KeepAlive can't bring it
  back.

## Scope

1. One floor, **22.16.0**, in `server/config.mjs`. `start`, `ops-cli.mjs`, `accounts.mjs` and `start.mjs` all read it; the
   shell script reads it through `node -e` or a tiny exported check.
2. Set `.nvmrc` to `22.23` (a version installed here that meets the floor). Add `package.json` `"engines": {"node": ">=22.16"}`.
3. `doctor` adds a check: the node in `com.workout.server.plist` exists, is executable, and is ≥ the floor. It FAILs otherwise,
   and prints the path and version. A path under `~/.nvm` gets a one-line note: if that version is uninstalled, re-run
   `server/start`.

## Out of scope

- Installing a system Node.
- Changing which node `start` picks (still `WORKOUT_NODE` or `command -v node`).

## Acceptance criteria

1. `grep -rn "22\.1[36]" server/` shows only the floor constant (paste it).
2. **Failure:** doctor with a plist whose node path doesn't exist → FAIL naming the path. Test it on a throwaway label or plist.
   A node below the floor gives the same FAIL.
3. `./check` green. Deploy is Planner's, after merge.
