# req-33 — `plan doctor`: one command that verifies (and explains) the setup

**Status: BUILT AND MERGED, 2026-09-12 — branch `req-33` (`130d30e`…`130d30e`, 1 commit).** Re-scan `plan` and the README setup block against
live code before sending to CC; the checks below are the intent, not final line numbers.

**Gate: functional** (DEC-009) — planning verifies + merges; no gym-test needed.

## Why

First-machine setup is a manual checklist in `README.md` §Setup, and a wrong step fails **silently
and late**: the two-separate-clones mistake (instead of one repo + two worktrees) doesn't surface
until the first `./plan` call dies with *"found the planning worktree but no second (code)
worktree"*. Verifying setup today takes a dozen manual git probes. `plan` already knows what
"correct" looks like (`find_worktrees`), so it should be able to check it.

## The behaviour (decided)

Add `plan doctor` — a **read-only** subcommand that checks each setup invariant and prints
`ok` / `FIX:` per line, exits non-zero if any check fails, and never modifies anything. Checks:

1. **Layout** — one repo, two worktrees (planning + a code worktree). This is the check that
   catches the separate-clones trap; reuse/replace `find_worktrees` so the diagnostic is specific
   ("looks like two separate clones — convert with: …" pointing at the README recovery block).
2. **hooksPath** — code worktree has `core.hooksPath=.githooks`.
3. **Dependencies** — `node_modules/` present in the code worktree.
4. **Grants file** — `<planning>/.claude/settings.local.json` exists.
5. **Git identity** — `user.name` and `user.email` are set (not the auto `user@host.local`).
6. **Ends by running `plan status`** so layout + drift are shown in one go.

Add it to `usage()` and the `case` dispatch. Wire it into README §Setup as the final **step 6**
(replacing the current bare `plan status` verify line) so setup ends with `./plan doctor`.

## Scope

- New `cmd_doctor` in `plan` + usage/dispatch entry.
- README §Setup: final step becomes `../workout-codebase/plan doctor`.

## Out of scope

- Any auto-repair (`doctor` only diagnoses; the README holds the fix commands). A future
  `plan setup --fix` could come later if wanted — not now.
- Changing `find_worktrees`' existing callers' behaviour.

## Acceptance criteria

- **Healthy machine:** on the correct layout, `./plan doctor` prints all `ok` and exits 0.
- **Broken layout (measured):** run against a separate-clone planning dir → it reports the layout
  failure with the convert-to-worktree hint and exits non-zero. (Repro the state from this session.)
- **Missing identity:** with `user.email` unset, doctor flags it `FIX:`.
- **Read-only:** `git status` in both worktrees is unchanged after a `doctor` run.
- **No regression:** `./check` green; `plan status`/`publish`/`closeout` behave as before.

## Notes

- This came out of the 2026-09-12 session that hit the separate-clones trap during a setup audit;
  `plan doctor` is that audit, made runnable.
