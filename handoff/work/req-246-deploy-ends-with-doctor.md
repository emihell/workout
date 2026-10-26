**Status: WITHDRAWN 2026-10-26 (Planner)** · **Lane: tooling** — its premise was wrong. `server/deploy` runs under
`set -euo pipefail` (`server/deploy:6`), so a failed second bootstrap already fails the deploy loudly, and `server/start`
already refuses a node below the floor. What was left — "nothing runs the doctor" — is a process step, not code: added to
`rules/CLOSEOUT.md` step 4. The spec below is kept as written.

# req-246 — `./server/deploy` ends with the doctor, and fails if it finds a problem

## Why

Nothing in the process runs `./server/doctor` after a deploy. Planner ran it by habit on 2026-10-26; neither
`handoff/rules/CLOSEOUT.md` nor `.claude/skills/closeout/SKILL.md` names it [measured: `grep -rn doctor` → only
`rules/BACKEND.md:26`]. The missed nightly backup of 2026-10-26 (DEC-136) was found by luck, not by a check. Two
review nits (req-231) are the same gap: `server/start` bootstraps two agents in a row (`server/start:74-75`) under
`set -euo pipefail`, so if the second bootstrap fails the server runs with **no backup agent** and deploy reports
success; and launchd runs an nvm node (`doctor` 2026-10-26: `launchd node: …/.nvm/versions/node/v26.8.2/bin/node`)
that disappears if that version is uninstalled. The doctor already detects all of these (`server/ops-cli.mjs:179,184`)
and exits 1 on any problem (`server/doctor:4`, `ops-cli.mjs:197-198`). It just isn't run.

## Facts (rescanned 2026-10-26, main `a5b8d63`)

- `server/deploy` ends: stop if running → swap live dir → `say "deployed …"` → `server/start` if it was running, else
  "not running — start it with …" (last 13 lines).
- `server/doctor` is read-only and exits 1 on any failed check.

## Scope

1. At the end of `server/deploy`, **when the server was started by it**, run the live copy's `server/doctor`. On exit 1:
   print `deploy: the doctor found a problem — the new build IS live; see above` and exit 1. On 0: unchanged.
2. When deploy didn't start the server (it wasn't running), don't run the doctor (it would fail on health). Say so in
   the existing "not running" line.
3. `.claude/skills/closeout/SKILL.md`: where it deploys after a `server/`/sync closeout, a red deploy means "read the
   doctor's lines, fix, re-run `./server/doctor`" — cite, don't quote (L-059).

## Out of scope

- Rolling back on a red doctor (the build is live; a rollback is its own decision — `server/deploy` keeps `$PREV`).
- Replacing the nvm node with a system node, XML-escaping plist paths (the paths have no `&<>` today), the DEC-133
  scan's `JSON.parse` speed — BACKLOG, not fallout.
- Any alerting when the server dies between deploys.

## Acceptance criteria

1. Deploy on a throwaway instance (BACKEND rule 2: temp data dir, free port, throwaway label, as req-231's tests do)
   → ends with the doctor's lines and `doctor: all ok`, exit 0. Paste.
2. **Failure case, the guard fires:** same throwaway, make the second bootstrap fail (the stubbed `launchctl` in
   `server/ops.test.mjs:489` pattern) → deploy exits 1 with the scope-1 message, and the doctor line names
   `<label>.weekly` as not loaded. Paste. A test in the server suite holds this.
3. Deploy with the server not running → no doctor run, exit 0, the "not running" line. Paste.
4. `./check` green; `python3 scripts/check_skills.py` exit 0.
5. **Planner, after merge:** the next real `./server/deploy` ends with `doctor: all ok` — paste in SHIPPED.

## Decisions made on Emilio's behalf

- implementation: doctor only after deploy started the server; no rollback on red. Nothing he sees changes.
