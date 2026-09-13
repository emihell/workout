# req-61 — gitignore `.claude/worktrees/`

## Technical

Added to root `.gitignore`, next to the existing `.claude/settings.local.json` line:

```
# ephemeral build-agent git worktrees (isolation: worktree)
.claude/worktrees/
```

Ignores only `worktrees/`, not all of `.claude/`. No code changed.

### Verification receipts

Scope preserved — `.claude/settings.json` and `.claude/skills/` still tracked:

```
$ git ls-files .claude/
.claude/settings.json
.claude/skills/audit/SKILL.md
```

Worktrees dir now ignored (created `.claude/worktrees/agent-test/x`, then removed):

```
$ git status --porcelain | grep worktrees
(nothing — ignored)
$ git check-ignore .claude/worktrees/agent-test/x
.claude/worktrees/agent-test/x
```

Gate:

```
check: green — lint, 18 test file(s), and the build all passed.
```
(213 tests pass, 0 fail.)

## Workflow

No deviation. One-line infra change exactly as specified. Fixes L-011 (parallel
agent worktree dirtied `git status`, blocking `plan closeout` on a sibling req).
Not merged, not pushed.
