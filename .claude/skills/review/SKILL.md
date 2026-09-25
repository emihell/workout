---
name: review
description: Load FIRST, before reading any file, whenever asked to review, get a second opinion on, or independently check req-N / a branch / a diff / a spec, or when a diff touches a reviewer-trigger file. Spawns a read-only reviewer and returns blocker / should-fix / nit / latent findings, each with a failure scenario.
---

Sources: when it must fire — `handoff/rules/WORKFLOW.md` §Before a requirement is tagged READY, check 5 (DEC-057 §1);
how a branch is reviewed — the same file, §Reviewing a branch; the guards — **L-031** and **L-036**
(`handoff/log/LESSONS.md`).

1. **Does it fire?** `git diff --name-only main...<branch>` against check 5's file list. If any match, the review
   is required before merge; say which files triggered it.
2. **Spawn one fresh agent** (Agent tool, read-only brief: it may run commands and tests, never edit, commit, or
   merge). Give it only: the branch, the req doc path, the report path, `git diff main...<branch>`, and the DECs whose
   nouns the diff touches (grep `handoff/log/DECISIONS.md`, WORKFLOW READY check 1). No conversation history — that
   is the point, and why step 4 exists.
3. **Required output format** (put this in the brief):
   - Each finding: severity (`blocker` / `should-fix` / `nit` / `latent`), `file:line`, a **failure scenario**
     (concrete input or state → the wrong output or crash), and a receipt (command + output) or `[inferred]`.
   - `latent` = a real defect currently masked by other code; name the masking code.
   - Test edits in the diff: each judged real change vs weakening.
   - If there are no blockers, the literal line **`No blockers.`** Silence is not a verdict.
4. **Filter before acting (L-031):** check each proposal against the DECs and the before-state; drop any that undo
   a recorded decision, and say so.
5. **Keep the latent list.** When a later commit (a revert, a cleanup) removes the masking code, re-check those
   findings in the browser (L-036), not only the tests.
6. For a re-review of a follow-up commit, send the same agent the new range (`git diff <old>..<new>`).
