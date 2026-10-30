**Status: BUILT AND MERGED, 2026-10-30 — branch `req-253` (`a7973d7`…`ab7c028`, 2 commits).** · **Lane: tooling** · DEC-144 §1 (clean point), L-048 (node_modules), L-065 (node). After req-250/251 (edits their code).

# req-253 — `plan brief` derives the code worktree; `plan next` reads a multi-line **Next:**

## Why (observed 2026-10-30, this machine)

1. **Hardcoded path.** `plan:497` `local code_dir="~/projects/workout/workout-codebase"`; this machine's code worktree is
   `~/dev/workout/workout-codebase` (`git worktree list` → `/Users/emilio/dev/workout/workout-codebase aafae6c [main]`). A
   builder following the brief symlinks a path that doesn't exist. The test pins the wrong path:
   `scripts/plan-guards.test.sh:201` greps for `ln -s ~/projects/workout/workout-codebase/node_modules`.
2. **Truncated resume line.** `cmd_next` (`plan:612-619`) takes the `**Next:**` line with `grep -m1`, a single line. NOW.md's
   Next ran over two lines; the resume prompt Emilio pasted ended mid-sentence: `(Next: … Before the first dispatch here:
   \`./plan brief\`'s and BUILDER.md's)`. `check_handoff.py:624-635` (`check_next_line`) only counts lines starting
   `**Next:**`, so it didn't catch it.

## Scope

1. `cmd_brief`: `code_dir` = the **main worktree**, the first entry of `git worktree list --porcelain`. Keep the reason in the
   comment at `plan:493-496`: `find_worktrees` picked a scratch worktree on 2026-10-30, so don't use it. Print an absolute path.
   If `$code_dir/node_modules` is missing, warn on stderr **without the word `node_modules`** so the brief's
   `grep -c 'PATH=\|node_modules\|commit early\|do not merge'` still counts 4 (req-251 #1). Example: `no deps dir in <path>`.
2. `cmd_next`: read the whole `**Next:**` **paragraph**, i.e. the `**Next:**` line plus the lines after it up to the first
   blank line or the first line starting `#`, `- ` or `**`. Join the lines with single spaces and strip the prefix.
3. `check_handoff.py` `check_next_line`: unchanged rule (exactly one line starting `**Next:**`). Update its comment to say that
   `plan next` reads the paragraph.
4. Tests: `scripts/plan-guards.test.sh`.
   - brief asserts the fixture's main-worktree path (`$CODE/node_modules`), not a `~/projects` literal.
   - The count stays 4 with **no** node_modules in the fixture, so the warning fires and still doesn't add a match.
   - next has a fixture with a two-line Next.

## Out of scope

- `handoff/` docs (BUILDER.md was updated by Planner in `cdecdb6`; WORKFLOW/CLOSEOUT/PLANNING still say `~/projects/workout`
  and are Planner's).
- Other `CODE_DIR`/`find_worktrees` users (`plan:1221`, `:1523`, `:1588`). They are correct here (two worktrees).

## Acceptance criteria

1. In a fixture whose main worktree is at a temp path, `plan brief` prints `ln -s <that path>/node_modules node_modules`.
   The receipt is the test line plus `./plan brief req-253` run on this machine, showing `/Users/emilio/dev/workout/workout-codebase`.
2. **Failure case — absent input:** with no `node_modules` in the main worktree, brief exits 0, the stderr warning appears,
   and the mechanical-line count (stdout+stderr, as the test captures it) is still 4.
3. **Could it pass for the wrong reason:** brief lists an extra top-level worktree on another branch, added after main.
   brief still names the main worktree, not the extra one.
4. `plan next` with NOW.md `**Next:** a b\ncontinued c\n\n## X` prints `(Next: a b continued c)`. With a one-line Next the
   output is unchanged (the existing test at `plan-guards.test.sh:43` still passes, unedited).
5. **Failure case:** a Next paragraph followed directly by `- bullet` or `**Other:**` stops before that line.
6. `bash scripts/plan-guards.test.sh` and `bash scripts/check-handoff.test.sh` are all green, and `./check` passes. Any edited
   test assertion is named and justified in the report (the `:201` literal is expected to change).

## Decisions made on Emilio's behalf (implementation)

- Read the multi-line paragraph rather than require one line. Requiring one line would make NOW's Next a one-liner and push
  context into a second line `plan next` drops. His steps don't change: he still pastes one line.
- "Code worktree" = the main worktree (the git common dir's checkout), the same on both machines.

## READY checks

1. DECs: DEC-144 §1 (clean point → `plan next`), L-048, L-065. Nothing conflicting.
2. Siblings: req-250 (`cmd_next`, check 3), req-251 (`cmd_brief`, count of 4). Both merged; this edits their code after them.
3. Deferrals: none. 4. Numbers: count 4 from `plan:499-500`.
5. Trigger files: none (no store/model/storage/progress/migration). No reviewer or backup reminder needed.
6. No user-visible calls.
