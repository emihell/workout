---
name: closeout
description: Load FIRST, before reading any file, whenever asked to close out, merge and record, ship, or finish off req-N after its gate passed (planning session). The checklist — recording pass, `./plan save`, `./plan closeout req-N`, push receipts, the deploy's CI run.
---

The process is `handoff/rules/CLOSEOUT.md` — read it in full; this is the checklist that runs it. Merge only on
the gate the lane sets (`handoff/rules/WORKFLOW.md` §Requirement lanes; DEC-035 and its carve-outs).

1. **Recording pass first**, in CLOSEOUT.md's order (§Assistant, at close-out, step 1). `closeout` does not record.
   The req Status stays "NOT merged" until `closeout` flips it (§Preconditions).
2. **Commit the recording pass through `./plan save`** — the one path for handoff/ commits (L-032 says why).
3. **Confirm state read-only** (§Assistant step 2): `git --no-optional-locks rev-parse --short req-N`,
   `git --no-optional-locks log main..req-N --oneline`.
4. **Run `./plan closeout req-N`** yourself. Nothing by hand; if it can't run, CLOSEOUT.md §Fallback.
5. **Receipts to paste:** `closeout`'s tail (merge commit, `./check` green line, push lines),
   `git log origin/main --oneline -1`, and `./plan status` showing "planning is fully merged, both worktrees clean"
   (§Done when).
6. **The deploy:** `gh run list --workflow deploy.yml --limit 1`, then `gh run watch <id> --exit-status`.
   Paste the run id and its result, the smoke step included. A red run means the site did not ship — say so and
   open a bug-lane req; don't re-push blind.
