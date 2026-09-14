# req-69 — Two follow-ups from the 65–68 blocking batch

**Status: SHIPPED 2026-09-14** — planning-owned, published to `main` (no code branch). Two
follow-ups from the 65–68 batch: a `handoff/` edit + a machine-local git-config correction.

**Gate: infra/docs + setup.** Builder: **planning (Planner)**. Merges on Planner's own read.

## Why

1. **`rules/WORKFLOW.md:217` still carries the stale merge-model claim** req-65 fixed in
   `CLAUDE.md`: *"…the planning session reviews the diff and closes out, merging by req type
   (DEC-009) — Emilio uses UX and persisted-data reqs himself…"*. DEC-035 replaced that
   (planning merges on its own testing; carve-outs only). req-65 was scoped to `CLAUDE.md` and
   flagged this as out-of-scope. Same "fact in two places, follow the one you never read" trap.

2. **`plan doctor` false-fails on hooks** [measured 2026-09-14]: it prints
   `FIX: hooks — code worktree core.hooksPath is '/…/workout-codebase/.githooks', expected
   .githooks` and exits 1. The path is **absolute**; doctor (`plan:598`) checks for the literal
   relative `.githooks` that README §Setup prescribes. The hook runs fine either way (Builder
   verified during req-66), so this is a false failure, not a real break — but a red `plan
   doctor` erodes the signal. Surfaced by Builder in the req-66 report.

## Scope

1. **WORKFLOW.md:217** — rewrite the stale sentence to the DEC-035 model (planning tests what it
   can reach and merges on that; the two carve-outs — migration/bulk-rewrite → Emilio, shared-code
   → independent reviewer — are the only human/reviewer gates), and reference DEC-035. Keep it to
   that sentence/paragraph; do not restate DEC-035.

2. **`core.hooksPath`** — reset the code worktree to the documented relative value:
   `git -C ~/projects/workout/workout-codebase config core.hooksPath .githooks`. Verified the
   guard still fires with a relative path, including from a subdirectory (git resolves a relative
   `core.hooksPath` against the worktree top, not cwd — scratch-repo test 2026-09-14). This is a
   machine-local setup correction (git config is untracked), not a code change.

## Out of scope

- **Hardening `plan doctor` to accept an absolute path** that resolves to the worktree's
  `.githooks` (so config drift can't false-fail again). That's the robust fix but it's a `plan`
  script edit = **code/Builder's domain** (DEC-005 isolation: planning does not edit the `plan`
  script through the planning lane). Left as an optional future Builder req; noted, not done.
- Any other WORKFLOW.md content; any code.

## Acceptance

- `grep -n "himself\|merging by req type (DEC-009)" handoff/rules/WORKFLOW.md` → the stale phrasing
  is gone; DEC-035 is referenced near that spot. Quote before/after.
- No other `handoff/` doc still asserts the pre-DEC-035 gate (grep and report).
- `./plan doctor` exits 0 with no `FIX: hooks` line; `git -C …workout-codebase config --get
  core.hooksPath` → `.githooks`.
- The pre-push guard still fires after the change (re-confirm: a FF `req-*` push is refused).
- `check_handoff` passes.

## Decisions

- **doctor fix = config, not code (Planner's call):** the minimal correct fix is to make the
  config match the documented setup, which Planner can run now; the code-level hardening is
  deferred to Builder as out-of-scope above.
