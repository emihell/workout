# req-61 — gitignore `.claude/worktrees/` so parallel agent builds don't block closeout

**Status: BUILT AND MERGED, 2026-09-13 — branch `req-61` (`82aee03`…`82aee03`, 1 commit).** From Emilio 2026-09-13 (workflow feedback). Fixes L-011.

**Gate: infra.** One line in `.gitignore`; planning builds + tests + merges on its own
testing.

## Why — reproduction

[measured] Ephemeral build agents (`isolation: worktree`, DEC-037) create git
worktrees at `<code>/.claude/worktrees/agent-*`. While one is still active, the code
worktree's `git status --porcelain` shows `?? .claude/worktrees/`, and `plan closeout`
refuses — *"code worktree has uncommitted changes"* (hit on req-57 + req-58 running in
parallel; L-011). So a parallel build blocks closing out its sibling; today it was
worked around by serializing the closeouts.

## The fix

Add `.claude/worktrees/` to the code repo's `.gitignore`. It already ignores
`.claude/settings.local.json`; `.claude/settings.json` and `.claude/skills/` are
**tracked and must stay tracked** — so ignore **only** `worktrees/`, never all of
`.claude/`.

## Scope

- `.gitignore` (code repo): add `.claude/worktrees/`.

## Out of scope

- Anything else in `.claude/`; the harness's worktree creation (not ours to change).

## Acceptance criteria (written before implementation)

- **Ignored:** with a directory present at `.claude/worktrees/` (e.g. create
  `.claude/worktrees/agent-test/` with a file), `git status --porcelain` shows nothing
  for it — the dir no longer dirties the tree.
- **Scoped (failure case):** `.claude/settings.json` and `.claude/skills/` are still
  tracked — `git ls-files .claude/` still lists them; the ignore did NOT swallow the
  rest of `.claude/`.
- **No regression:** `./check` green — paste the line.

## Decisions

- **implementation (CC's call):** none beyond the one line.
