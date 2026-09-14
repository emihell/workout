# req-66 — Enforce (or tolerate) the --no-ff-merge-to-main invariant

**Status: READY.** **BLOCKING** (workflow-review finding #2, 2026-09-13).

**Gate: infra/tooling.** Builder: **code session** — touches `.githooks/` and/or the `plan`
script (root, not `handoff/`). Planning specs + verifies + merges (DEC-035); spawn no
reviewer (tooling, no product blast radius) unless the guard logic warrants it.

## Why

The closeout/status machinery *assumes* every req reaches `main` via a `--no-ff` merge — it
reads the `Merge branch 'req-N'` commit's two parents to compute the status line. When the
code session FF-merged four reqs this session (req-49/50/62 + demo), there was no merge
commit, so `plan closeout` could not compute or flip their status — it warned and left the
docs unchanged, forcing a hand-recovery. The invariant is load-bearing but lives only in
prose (`CLOSEOUT.md`: "`--no-ff` forces a 'Merge branch' commit the drift check reads"), so
a single slip broke it. A machine-depended-on convention should be guarded, not remembered.

## Scope — pick ONE approach (code session's call, state which)

**A. Guard it (preferred if cheap):** a `.githooks/pre-push` (or equivalent) that refuses a
push advancing `main` by a commit that is a plain fast-forward of a `req-*` branch — i.e.
require the tip of `main` to be a merge commit when it moved via a req branch. Must not
block the legitimate `plan closeout`/`plan publish` paths (they use `--no-ff` and merge
`planning`). Print the fix (re-do as `--no-ff`).

**B. Tolerate it:** make `plan closeout` compute the commit range for the status flip from
the branch itself (`git merge-base main <branch>`..`<branch>`) even when the merge was a FF
(no merge commit) — so reconcile-mode works regardless of how the req landed. This removes
the fragility instead of policing it.

B is more robust (it fixes the actual break — reconcile after a FF); A prevents FFs entirely.
The code session decides; if A is disproportionately fiddly for this git setup, do B.

## Out of scope

- Changing the normal `--no-ff` closeout behaviour. This only adds a guard OR a fallback.

## Acceptance

- **Repro the original break, then show it fixed.** In a throwaway worktree: FF-merge a
  dummy `req-*` branch to a scratch `main`, then either (A) the guard refuses the push with a
  clear message, or (B) `plan closeout` correctly computes + flips the status from the FF'd
  branch. Paste the transcript.
- The legitimate path is untouched: a normal `--no-ff` `plan closeout req-N` still works
  end-to-end (run it, or dry-run, and show it).
- `./check` green.

## Decisions

- **approach A vs B (code session's call):** state which and why in the report; B if A is
  disproportionate.
