# Workflow update plan — 2026-10-30

Independent review (fresh agent, read-only) of `audits/2026-10-30.md`, `handoff/audits/workflow-2026-10-30.md`, scans of
white-sleeve and Emilio's work Claude setup, and the 10-30 session. Emilio took all five recommendations → DEC-144.

**Verdict on Emilio's asks.** Stop between reqs: right; the batch rule (PLANNING:264-266) skipped it, written for Builder.
"Planner decides when to clear": partly wrong — Planner can't see its token count; every closeout is a clean point,
printed by code; Emilio (who sees the meter) is the backstop. Throwaway agents: right and mostly in place; missing is the
brief file, and agents load a CLAUDE.md that says "You are Builder". Builder only for feel work: right, same brief.
Missed: 10-30's three slips (wrong-machine deploy, two conflicting records, an unasked DEC) need guards, not stops.

| Req | What | Net |
|---|---|---|
| req-249 | `check` refuses node < floor; server scripts refuse off the server machine; `plan save` refuses when behind | prose → code |
| req-250 | `plan next` prints CLEAN POINT + resume prompt; NOW needs `**Next:**`; batch/Builder prose cut | ≈ −100 lines |
| req-251 | `handoff/BUILDER.md` + `plan brief`; closeout refuses a report without `## What I ran` receipts | ≈ −30 |
| req-252 | closeout prints the deploy line; SHIPPED stub = 3 lines, warn above | less churn |
| later (after Phase 1) | DECISIONS split + digest; drop `git commit/reset` grants + doctor's list; hook text; doc-size ratchet | moved |

**Not adopted:** replay-tested PreToolUse hooks, a citations checker, risk tiers (lanes do it), a second blind reviewer,
session-start/end hooks (miss on crash), run logs, an osascript approval dialog, DEC/L scaffolding, splitting WORKFLOW.md,
a DEC for the two machines (req-249's guard replaces it).

**Risks.** The agent trusting its own receipts → the test list is the req's criteria written before the build; receipts
are stored values; Planner spot-checks one item; `plan publish` + CI re-run the gate; the reviewer gate stays. Tokens move to
the agent → add a `tokens:` line to the report. The earned batch visibility rule (WORKFLOW:271-283) survives in BUILDER.md.
State lost across a stop → NOW's `**Next:**` is required; an agreement only in chat is a "don't clear" case.
