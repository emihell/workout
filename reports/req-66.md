# req-66 — Enforce the --no-ff-merge-to-main invariant

Branch: `req-66`. Ready to look at — **not merged, not pushed.**

## Chosen approach: **A (guard), not B (tolerate)** — and why B cannot work as specified

The spec steered toward B ("compute the range from `git merge-base main <branch>..<branch>`")
unless A was disproportionately fiddly. I chose **A** because **B's premise is false for a
pure fast-forward**: once a `req-*` branch is FF-merged, its tip *becomes* the merge base with
main, so `merge-base main <branch>..<branch>` is **empty** — the same empty range that broke
closeout in the first place. The commit range is genuinely unrecoverable from refs after a
pure FF. [measured]

```
# treating FF'd req-49 (41ab51c) as a still-existing branch tip:
$ git log --oneline main..41ab51c          # -> (empty)
$ mb=$(git merge-base main 41ab51c); echo $mb
41ab51c2fe1eca2aa4e326654096819a597d59d7   # == the tip itself
$ git log --oneline "$mb..41ab51c"         # -> (empty)
```

"Tolerating" it would mean **inventing** a commit range, which cuts directly against this
project's core rule (history is the source of truth; never invent data you don't have). A is
also the cheaper build here: it's one new hook file and touches **nothing** in the `plan`
script that Planner depends on.

## What changed

One new file: **`.githooks/pre-push`** (executable). Nothing else — `plan`, `pre-commit`,
and all source are untouched. `git diff --stat main`: `.githooks/pre-push | 84 ++++` plus this
report.

**The guard.** On a push to `refs/heads/main`, it refuses if any local `req-*` branch's tip
sits on the **first-parent commits the push newly adds to main**. The signal is exact and
topological, not heuristic:

- `--no-ff` merge → branch tip is the merge commit's **second** parent → **off** main's
  first-parent spine → allowed.
- fast-forward → branch tip lands **on** the first-parent spine → refused.

Verified against real history: FF'd req-49 (`41ab51c`) is on main's first-parent spine;
properly-merged req-62 (`e5737f8`) is not. [measured]

This is why the guard does **not** over-block the legitimate paths:
- `plan closeout` merges with `--no-ff` and pushes **while the branch still exists** (it
  deletes only afterward) — tip off-spine, allowed.
- `plan publish` fast-forwards `planning`'s **doc** commits onto main — those are never a
  `req-*` branch tip, so nothing matches.
- Any push not touching `main` (e.g. Planner's `origin ... planning`) is skipped entirely.

Escape hatch, matching the house `WORKOUT_SKIP_CHECK` precedent and never silent:
`WORKOUT_ALLOW_FF=1 git push …`.

**Known limit (stated, not hidden):** the guard matches on the *local `req-*` branch still
existing*. In the real break, Builder hand-merges but does not delete the branch (deletion is
closeout's job), so the branch is present at push time. If someone both FF-merges *and* deletes
the branch before any push, there is no ref left to match — but by then the range is already
lost, which is the very thing A exists to prevent by refusing earlier.

## Acceptance — receipts

All three run in a throwaway repo (bare `origin.git` + a clone with `core.hooksPath` pointed
at the real `.githooks/pre-push`), plus `./check` in this repo.

**1. Repro the break, then show it fixed.** [measured]
- FF-merge dummy `req-99` into scratch main → `git push origin main` **refused** (exit 1),
  printing the offending branch (`req-99 (…)`) and the `--no-ff` fix.
- Apply the printed fix (`reset --hard origin/main` + `git merge --no-ff req-99`) → push
  **succeeds**; main gains a real `Merge branch 'req-99'` commit. This is exactly the merge
  shape `plan closeout` produces (`plan:506` `git merge --no-ff`).

**2. Legitimate path untouched.** [measured] The `--no-ff` merge in 1b is the mechanism
`plan closeout` uses, pushed with the branch still present (as closeout does, `plan:533`
before the delete at `plan:535`) — **allowed**. Additionally: a planning doc-commit FF onto
main → **allowed**; a non-main push (`planning`) → **allowed**; `WORKOUT_ALLOW_FF=1` override →
allowed with a printed notice. I did **not** run the real `plan closeout`/`plan publish`: they
merge and push real branches and are Planner's to run, not Builder's. The scratch demo is the
faithful proxy for the one thing that could regress — the push.

**3. `./check` green.** [measured]
```
# tests 218  # pass 218  # fail 0
check: green — lint, 19 test file(s), and the build all passed.
```

## Technical notes

- Hook uses `git rev-list --first-parent <remote>..<local>` for the newly-pushed spine; on a
  brand-new remote main (all-zero remote sha) it falls back to the whole spine (strictly safer).
- `set -euo pipefail`; empty-array access guarded via `${#violations[@]}`; the inner
  `for-each-ref` loop reads from a process substitution so it never consumes the ref list on
  stdin.
- `bash -n` clean. shellcheck not installed on this machine, so not run.

---

## Workflow

- **Deviation from the spec's steer (B → A), with reason above.** This is worth a `DEC-`: the
  spec's proposed B formula (`merge-base main <branch>..<branch>`) is empty after a pure FF, so
  B as written re-introduces the exact bug. A prevents the FF instead. If Planner disagrees and
  still wants a tolerate-path, the only honest version would read the range from main's reflog
  or the push event — not from refs — and I'd want that scoped as its own req.
- **Scope held.** Only added `.githooks/pre-push`; did not touch `plan` or change the normal
  `--no-ff` closeout behaviour (spec's out-of-scope line respected).
- **Possible follow-up for Planner:** `core.hooksPath` in this code worktree currently reads as
  an **absolute** path, while `plan doctor` (`plan:598`) checks for the literal string
  `.githooks`. The hook is still found and runs, so req-66 is unaffected — but `plan doctor`
  may report a false `FIX: hooks` on this machine. Flagging, not fixing (it's Planner's tool).
