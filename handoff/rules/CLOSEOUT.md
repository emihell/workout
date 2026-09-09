# Closing out a requirement

The ONE process for merging a built branch and recording it. Identical every time.
The **planning session runs closeout**, after the merge gate (DEC-009): it closes
**functional** reqs itself once it has browser-verified them; **UX-feel** and
**persisted-data** reqs wait for Emilio's use-it OK first, then the planning session
runs closeout. The planning session records the req and runs the command. No freehand
variants.

This whole sequence is one command — `./plan closeout req-N`. The manual block below
is the fallback if `closeout` can't run.

## Preconditions
- CC reports the branch built + human-verified, NOT merged.
- Planning has recorded it: `work/req-N-*.md` Status = "BUILT ... NOT merged", any
  `DEC-`/`L-` appended, `NOW.md` + `SHIPPED.md`-when-merged handled. **`closeout` does
  NOT record — it only merges, flips the doc Status, publishes, pushes, deletes the
  branch.** Do the recording pass first.
- **The req doc stays "NOT merged" right up until close-out.** Do not pre-flip —
  `closeout` flips it, computed from git, only once the merge is an ancestor of main.

## The command (the planning session runs, from either worktree — after the gate)
```
./plan closeout req-N
```
It does, in order: `rm -f` a stale `.git/index.lock` → `git checkout main` →
`git merge --no-ff req-N` → flip `work/req-N-*.md` Status to
`BUILT AND MERGED, <date> — branch \`req-N\` (\`<first>\`…\`<last>\`, K commits)`
**only after the merge is an ancestor of main** → `./plan save "req-N merged"` →
`./plan publish` (runs `./check`; honours `WORKOUT_SKIP_CHECK=1`) →
`git push origin main planning` → `git branch -d req-N` → prints `./plan status`.
Re-runnable: if `req-N` is already on `main` it skips the merge and reconciles docs +
publish + push. If `./check` is red it refuses **after** the local merge — nothing is
pushed, the branch is not deleted, and a re-run after fixing the gate recovers fully.

## Assistant, at close-out
1. Do the recording pass (Status still "NOT merged", `DEC-`/`L-`, `NOW.md` line moved
   to Recently shipped, `SHIPPED.md` narrative). Keep any "Spawned by:"-style note
   **after** the closing `**` of the Status span — `closeout` replaces the whole Status
   bold and would drop a note living inside it.
2. Confirm state read-only: `git -C <code> --no-optional-locks rev-parse --short req-N`,
   `git -C <code> --no-optional-locks log main..req-N --oneline`. Let `closeout` do the
   checkout/merge/publish/push — don't run those by hand.
3. Run `./plan closeout req-N` yourself (after the merge gate). Nothing else.

## Done when
`./plan status` prints "planning is fully merged, both worktrees clean." If it shows
handoff drift about req-N's status, the merge didn't land — re-run `./plan closeout
req-N` (idempotent; it clears the lock and recovers).

## Fallback — the manual block (only if `closeout` can't run)
Paste-safe, no inline comments. This is what `closeout` automates, line for line.
```
rm -f ~/projects/workout-app/workout-app-codebase/.git/index.lock
cd ~/projects/workout-app/workout-app-codebase
git checkout main
git merge --no-ff req-N -m "Merge branch 'req-N'"
cd ~/projects/workout-app/workout-app-planning
./plan save "req-N merged"
./plan publish
cd ~/projects/workout-app/workout-app-codebase
git push origin main planning
git branch -d req-N
cd ~/projects/workout-app/workout-app-planning && ./plan status
```
Why each line: `rm -f ...index.lock` FIRST — a cloud session may have left a stale lock
that blocks `checkout`; harmless if absent, the line that always gets forgotten.
`--no-ff` forces a "Merge branch 'req-N'" commit the drift check reads as evidence.
Order: merge BEFORE `./plan publish`, or publish refuses ("code worktree not on main").
`./plan publish` runs `./check` and merges planning→main; it does NOT push — the push
line covers both branches. `git branch -d req-N` only works once you're on `main` and
it's merged — the built-in check that the merge really happened. With this fallback,
flip the doc Status by hand as step 2 of the manual sequence.
