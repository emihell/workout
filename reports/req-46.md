# req-46 — workflow hardening: save-time drift warning, publish --push, closeout checklist

**Gate: infra.** Only `plan` changed (+ this report). No app code, no persisted
data. `./check` green. Branch `req-46`. Not merged.

## Technical

Three independent changes to `plan`, one branch.

### 1. `cmd_save` — non-blocking handoff-drift warning (`plan:117`)
After a successful commit, save runs
`python3 "$PLANNING_DIR/scripts/check_handoff.py" --repo "$PLANNING_DIR"` and, if
it prints drift, echoes it to stderr as `plan save: handoff drift — fix before
publish (non-blocking):` followed by the indented findings. The commit already
succeeded; save never refuses on drift (mirrors publish, req-34). check_handoff
reads git objects at HEAD (the commit just made), not the working tree, so it
sees the just-committed state. This catches e.g. `NOW.md` > 50 lines at save time
instead of after publish lands it on main.

### 2. `cmd_publish` — opt-in `--push` (`plan:119`, `plan:190`, case `plan:688`)
Added a flag parser at the top of `cmd_publish` (only `--push` accepted; any other
arg is a clean error). Default is unchanged — no push (DEC-008). On a **successful**
publish only, `--push` runs `git push origin main planning`. It sits at the very
end of the function, after every refusal path (each `exit 1`s earlier), so `--push`
never fires after a refusal or a failed `./check`. The `publish)` case now
`shift`s and forwards `"$@"`. `cmd_closeout` still calls bare `plan publish` and
does its own push, so no double-push.

### 3. `cmd_closeout` — prints the DEC-009 step-9 checklist (`plan:504`)
After the closing `plan status`, closeout **prints** (never edits handoff) the
maintenance checklist with filled values: req id, title (from the doc's first
`# ` heading, minus the `req-N —` prefix, via `sed -E`), the merge date
(`date +%F`), and the `./plan save … && ./plan publish --push` line. Prose stays
the author's; only the mechanical values are filled.

## Verification

Real `plan` commands are destructive (push/merge to origin), so I built an
**isolated sandbox** mirroring the two-worktree layout — planning + code
worktrees, a bare `origin.git`, the real `plan` and the real
`scripts/check_handoff.py`, a stub `./check`. Every scenario ran the actual code
paths end-to-end against that sandbox, never the production repo or its remote.
Harness: `scratchpad/verify_req46.sh`. Pasted receipts:

**#1a clean edit → commits, no warning**
```
plan save: committed (bd26b05) probe: harmless edit
```
**#1b NOW.md 70 lines → commits AND warns (non-blocking, exit 0)**
```
plan save: committed (b246e6c) bloat NOW past 50
plan save: handoff drift — fix before publish (non-blocking):
  [fail] size: handoff/NOW.md — is 70 lines — its own rule is ≤ 50
[exit code: 0]
```
**#2a `publish --push` → merges then pushes both branches**
```
plan publish: --push — pushing main and planning to origin
   b67ba2c..62cdfeb  main -> main
   b67ba2c..62cdfeb  planning -> planning
[origin/main ADVANCED: b67ba2c… -> 62cdfeb…  => push happened]
```
**#2b bare `publish` (new commit) → merges locally, does NOT push**
```
[local main moved: yes | origin/main moved: no]
[bare publish did NOT push — correct]
```
**#2c `publish --push` after a refusal (code worktree off main) → refuses, no push**
```
plan publish: refusing — code worktree is on 'side-branch', not main. …
[publish exit: 1]
[no push after refusal — correct]
```
**#3 `closeout req-99` → prints the filled checklist**
```
plan closeout: done. Now (DEC-009 step 9), before anything else:
  1. SHIPPED.md — append:  ## req-99 — sandbox demo: a throwaway requirement for testing closeout  (merged 2026-09-12)
  2. NOW.md — bump the shipped range to include req-99; move the "building" marker
  3. ./plan save "req-99 closeout"  &&  ./plan publish --push
```

**Gate:** `./check` → `green — lint, 15 test file(s), and the build all passed.`
(182 tests, build clean.) App is unaffected; run confirms no regression.

`bash -n plan` → SYNTAX OK.

## Workflow

- **No scope changes.** All three changes as specified; publish default stays
  no-push, closeout prints (never writes) handoff, #1 is a warning not a refusal.
- **Verification method deviated from "just run it".** The spec/message said to
  verify by running each command. Running the real `plan publish --push` /
  `closeout` would push and merge for real (irreversible, and CLAUDE.md reserves
  those commands for the planning session). I instead ran the real code paths in
  an isolated sandbox with a throwaway bare origin — same receipts, zero
  production risk. The sandbox uses a stub `./check` (the real one is
  lint+test+build) since publish only needs `./check` to exit 0. I did **not**
  run the three commands against the live repo; the planning session's own
  "verifies by running the commands + merges" pass will exercise them live.
- **New, benign interaction to note (candidate L- entry):** because closeout runs
  its internal `save` *before* publish, the new save-time drift check fires a
  **transient** non-blocking warning during every closeout — the doc is flipped to
  "merged" but that commit isn't in planning's HEAD until the subsequent publish
  fast-forwards it. It self-corrects; the closeout's final `plan status` prints
  clean. Observed in #3:
  `[fail] status: req-99 — tagged merged at 72cb92a, but that commit is not in HEAD's history`.
  This is the save-time warning behaving exactly as designed (non-blocking,
  commit still succeeds), just noisier inside closeout. Left as-is — suppressing
  it would mean special-casing save, which contradicts #1's "always warn". Flagged
  so the planning session can decide whether the extra closeout noise is worth a
  follow-up.
