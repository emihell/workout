**Status: BUILT AND MERGED, 2026-10-30 — branch `req-251` (`93c7751`…`7092d54`, 3 commits).** (into `wf-2026-10-30`) · **Lane: tooling** · DEC-144 §2, §5. After req-250 (stacks on its branch).

# req-251 — one build brief, and closeout refuses a report without receipts

## Why

Every throwaway agent's brief is retyped from memory; four lessons say "put it in the brief" (L-048, L-049, L-052, L-065).
Planner did req-244's QA itself, filling its own context. Now the agent QAs and pastes receipts; Planner reads them.
`handoff/BUILDER.md` (the brief text) is Planner's, on `wf-2026-10-30`. This req is the code around it.

## Scope

1. `plan brief req-N`: print a ready-to-paste dispatch prompt: the req path, the base branch to start from (default
   `main`, `--base <ref>`), and "Read `handoff/BUILDER.md` first and follow it" — plus the four mechanical lines in full
   (they must survive a brief that wasn't read): the `export PATH=…v22.23…` line (version from `.nvmrc`), the
   `node_modules` symlink, "commit early", "do not merge or push". Exit 1 if no `handoff/work/req-N-*.md`.
2. `plan closeout req-N`: refuse **before merging** unless `reports/req-N.md` on the branch has `## What I ran` containing a
   non-empty fenced block and a `## For Emilio` section (may say "nothing"). Port the idea from
   `/Users/emiliohellberg/projects/white-sleeve/white-sleeve-planning/plan` (its ready-file check), not its file name.
3. A test for both in the existing style for `plan` tests (find how `plan` is tested today; if it isn't, a small
   shell-driven `node --test` file that runs `./plan` against a scratch repo).

## Acceptance criteria

1. `./plan brief 250 | grep -c 'PATH=\|node_modules\|commit early\|do not merge'` → 4; `./plan brief 999` → exit 1.
2. **Failure case:** closeout against a scratch branch whose report lacks the fenced block → exit 1, main unchanged
   (`git rev-parse main` same before/after). With it → proceeds past the check.
3. `./check` green.
