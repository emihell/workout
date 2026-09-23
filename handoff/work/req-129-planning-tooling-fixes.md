# req-129 — planning tooling fixes found this session (BACKLOG tooling items)

**Status: SPEC — READY, held for Emilio's go.** **[infra]** Scripts only (`plan`, `.githooks`, `scripts/`); no app
code, no stored data. Rewritten 2026-09-23 after spec review, which found that the first draft's guard exemption would
disable the guard and that its reviewer warning would always fire.

## Why (each observed on 2026-09-23)

1. `plan publish` refused with "code worktree is on 'req-120'": `find_worktrees` lets the **last** non-planning worktree
   win (`plan:~76`), and a throwaway agent's worktree nested under `workout-codebase/.claude/worktrees/` came last.
2. The pre-push fast-forward guard refused a push because a just-created, still-empty `req-120` branch sat at main's tip.
3. DEC-057 / L-023: nothing mechanical warns when a merged diff touches store/model/storage/progress/workout-log or
   migration code without an independent reviewer.
4. `npm run shot` can't reach states behind a click or below the fold (req-105), and the L-024 before/after capture
   script lives in a scratchpad with a hardcoded path.

## The behaviour

1. `find_worktrees` **skips worktrees nested inside another worktree** (e.g. under `.claude/worktrees/`), keeping its
   branch-keyed design (`plan:~61-63`, since Emilio may rename directories).
2. The pre-push guard exempts a `req-*` branch **only if its reflog has no commit entries** (just "branch: Created
   from …"). A fast-forwarded branch that has commits of its own must still be refused.
3. `plan closeout req-N` warns (non-blocking) when the merge diff touches a DEC-057 trigger path and
   `reports/req-N.md` on the branch names no independent reviewer (it matches `Reviewer` / `independent reviewer`,
   case-insensitive). SHIPPED isn't checked: closeout writes that stub itself.
4. `npm run shot` gains `--click "<text>"` (repeatable; exits non-zero when the text isn't found) and `--scroll-bottom`.
   The L-024 capture moves into `scripts/capture.mjs` (`npm run capture -- --base <ref> --head <ref>`), with a
   repo-relative seed and an active-workout seed it builds itself.

## Scope

`plan`, `.githooks/pre-push`, `scripts/screenshot.mjs`, a new `scripts/capture.mjs`, `package.json`, the
`scripts/*.test.sh` self-tests.

## Acceptance criteria

- **Self-tests** (quote their output separately; `./check` doesn't run `scripts/*.test.sh`):
  - a fixture with a nested worktree → publish finds the right code worktree;
  - an empty, just-created `req-*` branch → push allowed;
  - **failure case:** an FF'd `req-*` branch with commits → still refused;
  - a diff touching `model.js` with and without a reviewer line in the report → warn / no warn.
- **Shot:** with an active-workout seed, `--click "Cancel"` produces the post-click PNG; `--click "Nope"` exits
  non-zero.
- **Capture:** `--base main --head main` compares more than 0 screens, all identical; a known one-line CSS change
  reports that screen as different.
- `./check` green (receipt quoted).
