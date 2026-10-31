# Audit triage — append-only

One line per audit file, added once every finding in it is in a req, BACKLOG or a `log/` entry:
`Triaged: <repo-relative path> YYYY-MM-DD` (the triage day). `scripts/check_handoff.py` check 7
(req-275) fails an audit file under `audits/` or `handoff/audits/` dated 2026-10-31 or later with
no line here; older files are exempt. Separately, every `F-*` id in `audits/*.md` must appear in
`work/`, `log/` or a later audit, whatever the date.

Triaged: audits/2026-10-30.md 2026-10-31
Triaged: handoff/audits/workflow-2026-10-30.md 2026-10-31
Triaged: handoff/audits/workflow-plan-2026-10-30.md 2026-10-31
