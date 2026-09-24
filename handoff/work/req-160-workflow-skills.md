# req-160 — Claude Code skills for the repeated procedures

**Status: READY** (2026-09-24) — tooling. DEC-085 (planning's list). Gate: tooling. Source:
`audits/workflow-2026-09-24.md` (recommendation 10). After req-159 (qa-branch uses `plan qa`).

Add skills under `.claude/skills/` (only `audit` exists), each short, pointing at the rule files rather than copying them:
- **qa-branch** — `plan qa <branch>`, dialog stubs, per-item stored-value receipts, isolated origin only (L-033).
- **review** — spawn an independent read-only reviewer on a branch diff: the DEC-057 §1 trigger list, the failure-scenario
  format, "no blockers" stated explicitly.
- **closeout** — the recording pass order from `rules/CLOSEOUT.md` + `./plan closeout` + the push receipts.
- **spec** — writing a req: rescan the code first, measured facts with file:line, out-of-scope, failure-case criteria,
  decisions marked unconfirmed.
- **workflow-audit** — the workflow-fit audit's scope (req types/lanes, automate, skills, remove, fix, holes).

## Acceptance criteria

- Each skill loads (`/skills` or a dry invocation), and its description triggers on the obvious phrasing (paste the list).
- No rule text duplicated: each skill links its source file (paste a grep).
