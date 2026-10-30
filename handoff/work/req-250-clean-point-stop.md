**Status: BUILT AND MERGED, 2026-10-30 — branch `req-250` (`8007206`…`b9d007a`, 2 commits).** (into `wf-2026-10-30`) · **Lane: tooling** · DEC-144 §1. After req-249 (stacks on its branch).

# req-250 — every closeout ends at a clean point, printed by code

## Why

Planner ran batch 7 without stopping; its context grew across reqs (Emilio, 10-30). PLANNING:264-266 let a batch skip the
stop. The stop must not depend on Planner remembering it, and Planner can't see its own token count — so: every closeout is
a clean point, and `./plan next` says so.

## Scope

1. `plan` `cmd_next` (`plan:402-452`): in its final "both worktrees clean, planning fully published" branch, print
   ```
   CLEAN POINT — good time to /clear. Then paste:
     Planner: resume from handoff/NOW.md (Next: <the NOW.md **Next:** line>)
   ```
   Read the `**Next:**` line from NOW.md on main. No other branch of cmd_next prints it.
2. `scripts/check_handoff.py`: NOW.md must have exactly one line starting `**Next:**` → error if missing.
3. `.claude/skills/closeout/SKILL.md`: a last step — "run `./plan next`; end your message with its output, verbatim".
   Keep `check_skills.py` green.

(The prose cut in PLANNING/WORKFLOW is Planner's, on `wf-2026-10-30`.)

## Acceptance criteria

1. `./plan next` with both worktrees clean + published → prints `CLEAN POINT` and the Next text. **Failure case:** with a
   dirty planning tree → no `CLEAN POINT`. (A test in a scratch repo, or a pasted run of each.)
2. `check_handoff` on a NOW.md without `**Next:**` → non-zero with a message; with it → 0.
3. `python3 -I scripts/check_skills.py` → 0 failing. `./check` green.
