**Status: BUILT, NOT merged — branch `req-257` (`4b589d1`…`50d5640`)** · **Lane: tooling** · DEC-144, DEC-155, req-90 (closeout ledger), req-251 (`plan brief`), req-253. Before req-259 (same file).

# req-257 — `plan`: closeout survives a doc with no title; the code worktree is never a scratch one; `ping` prints the brief

## Why (observed) [measured, `main` `4c1121b`, 2026-10-31]

**1. `plan closeout` dies silently after the merge when the req doc has no `# ` line.** `plan:1111`
`co_title="$(grep -m1 '^# ' "$doc" | sed …)"` runs under `set -euo pipefail` (`plan:4`). The comment above it (`:1105-1109`)
says the ledger steps are "non-fatal — never aborting after the merge already landed". Reproduction, the same line:

```
printf '**Status: READY**\n\nno heading here\n' > notitle.md
bash -c 'set -euo pipefail; doc=notitle.md; co_title="$(grep -m1 "^# " "$doc" | sed -E "s/^# +//")"; echo "reached: [$co_title]"'; echo "exit=$?"
exit=1          ← no message; "reached" never prints
```

In closeout this is after the merge (`:1095-1103` flips the status), so main is merged but nothing is saved, published or pushed.

**2. `find_worktrees` (`plan:100-130`) makes the last non-planning worktree `CODE_DIR`** (`:116-118`, any `branch refs/heads/*`
overwrites it). Nested worktrees are skipped (`worktree_is_nested`, `:89-98`), so agent worktrees under
`workout-codebase/.claude/worktrees/` are safe (today's `git worktree list` shows one, `agent-a38701b8…` on `req-256`). A second
**top-level** worktree is not. Reproduction (throwaway repo: main, `../workout-planning` on planning, `../workout-scratch` on
`scratch`, a nested `.claude/worktrees/agent-x`; `plan:89-130` sourced):

```
PLANNING_DIR=…/r257/workout-planning
CODE_DIR=…/r257/workout-scratch          ← should be …/r257/repo (the one on main)
```

`CODE_DIR` is where `plan closeout` merges and `plan qa` takes `node_modules` from (`plan:1600`).

**3. `plan ping` prints the pre-BUILDER.md handover** (`plan:404-420`: "New req to build … run ./check, write reports … in this
shape: 1 what it does / 2 what to test / 3 what you couldn't verify"). It never mentions `handoff/BUILDER.md` or the four
mechanical lines that `plan brief` (req-251, `plan:443`) prints. PLANNING §Build dispatches with `plan brief`; ping is still
listed in `plan help` (`:12-13`) and is the only command that checks the publish receipt (`:380-401`), which brief doesn't.

## Scope

1. **Closeout title:** compute `co_title` so that no match never aborts (`… || true`). Empty → use `$reqid` and print
   `plan closeout: WARNING — <doc> has no '# ' title; the SHIPPED stub uses "<reqid>".` Move the computation into a
   function (e.g. `closeout_title <doc> <reqid>`) so `_PLAN_NO_MAIN=1 source ./plan` (`plan:1604-1610`) can test it.
2. **CODE_DIR:** prefer the non-nested, non-planning worktree on branch `main`. With none on `main`, keep today's pick but
   print `plan: no worktree on main — using <path> as the code worktree` to stderr. With two or more non-nested,
   non-planning worktrees, also list them on stderr (a warning, not a refusal).
3. **`plan ping req-N`:** keep its refusals exactly as they are (bad id, no doc, doc not on main, planning unpublished). On
   success, keep the first line (`plan ping: $reqid is on main and planning is fully published — ready to hand off.`) and
   then print what `plan brief req-N` prints, from the same function, instead of the old block. Update `plan help` (`:12-13`).
4. Tests in `scripts/plan-guards.test.sh` (find_worktrees, ping) and `scripts/plan-ledger.test.sh` (title), the existing
   fixture style.

## Out of scope

- Any other `set -e` trap in closeout (not measured; list any you notice in the report).
- Refusing to run with an extra worktree. A warning is enough; a refusal would block Planner on a stale scratch tree.
- Wiring the `scripts/*.test.sh` files into `./check` (they are manual today, `check:60-160`). That's req-258's file, not this req.
- `handoff/` text about ping (Planner's).

## Acceptance criteria

1. **Failure case: a titleless doc.** `closeout_title` on a doc with no `# ` line → prints the WARNING, returns `req-N`, exit 0
   under `set -euo pipefail`. A doc with `# req-7 — A title` → `A title` (today's sed behaviour unchanged).
2. **The guard fires (self-test against the old code):** the new title test, run against `main`'s `plan`, fails
   (paste both runs).
3. **CODE_DIR:** in the test's throwaway repo with main + planning + a top-level `scratch` worktree + a nested agent
   worktree, `CODE_DIR` = the `main` worktree. The same repo without a `main` worktree → today's pick, plus the stderr line.
   Against `main`'s `plan`, the first case prints the scratch path (the test fails there; paste it).
4. **Ping:** on success, the output contains `ready to hand off`, `handoff/BUILDER.md` and the four mechanical lines,
   matching `plan brief req-N` byte for byte after its first line. All existing ping refusal tests pass unedited.
5. `bash scripts/plan-guards.test.sh`, `bash scripts/plan-ledger.test.sh` and `./check` are green. Every edited test is
   called out with the reason.

## Checks run (WORKFLOW §Before READY)

1. DECs grepped (closeout, worktree, ping, brief): DEC-144 (dispatch with `plan brief`), DEC-155. No DEC keeps ping's old text.
2. Siblings: req-259 adds `--empty` to `cmd_qa` in the same file. Build this one first; the rest is a rebase at most.
   req-258 edits `check`, not `plan`.
3. Deferral: none.
4. Numbers: line refs read on `main` `4c1121b`; reproductions above, run 2026-10-31.
5. Trigger files: none. No reviewer, no backup.
6. `(unconfirmed)`: none. Emilio's steps don't change.

## Decisions made on Emilio's behalf

- **implementation:** ping kept and pointed at brief rather than deleted, because it is the only command that checks the
  publish receipt; prefer `main` for CODE_DIR, warn rather than refuse; title falls back to the req id.
