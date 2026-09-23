# req-129 — planning tooling fixes found this session (BACKLOG tooling items)

**Status: SPEC — READY, held for Emilio's go.** **[infra]** Scripts only (`plan`, `.githooks`, `scripts/`); no app
code, no stored data.

## Why (each observed on 2026-09-23)

1. `plan publish` treats a throwaway agent's nested worktree (`workout-codebase/.claude/worktrees/agent-*`) as the code
   worktree and refuses: "code worktree is on 'req-120'".
2. The pre-push fast-forward guard refused a push because a just-created, still-empty `req-120` branch sat at main's
   tip ("req-120 (1dd4b54)").
3. DEC-057 / L-023: nothing mechanical warns when a merged diff touches store/model/storage/progress/workout-log or
   migration code without a reviewer named in SHIPPED.
4. `npm run shot` can't reach states behind a click or below the fold (req-105), and the before/after capture script
   L-024 relies on lives in a scratchpad with a hardcoded path.

## The behaviour

1. `plan` resolves the code worktree by its exact path (the `workout-codebase` directory), never a nested one.
2. The pre-push guard ignores a `req-*` branch with **no commits beyond main**.
3. `plan closeout req-N` warns (non-blocking) when the merge diff touches a DEC-057 trigger path and the SHIPPED entry
   has no "Reviewer:" line.
4. `npm run shot` gains `--click "<text>"` (repeatable) and `--scroll-bottom`. The L-024 main-vs-branch capture script
   moves into `scripts/` (`npm run capture -- --base main --head <branch>`), with the repo-relative seed.

## Scope

`plan`, `.githooks/pre-push`, `scripts/screenshot.mjs`, a new `scripts/capture.mjs`, `package.json`, their self-tests
(`scripts/*.test.sh` pattern).

## Acceptance criteria

- **Self-tests** for 1–3 (a fixture repo with a nested worktree; an empty `req-*` branch; a diff touching `model.js`
  with and without a Reviewer line).
- **Shot:** `npm run shot -- /workout/r --click "Cancel" --scroll-bottom` produces a PNG of the post-click state.
- **Capture:** `npm run capture -- --base main --head main` reports all screens identical.
- `./check` green (receipt quoted).
