---
name: workflow-audit
description: Read-only workflow-fit audit of the machinery (rules, plan, hooks, skills, CI) — writes a dated report to handoff/audits/. Changes nothing.
disable-model-invocation: true
---

What it is and where it goes: `handoff/rules/AUDIT.md` (companion paragraph) and its one rule, diagnose, don't
treat. The last run is the template — read it first: the newest `handoff/audits/workflow-*.md`.

1. **Scope** — the machinery, not product code: the files the last run's **Scope** line read, plus anything added
   since (`git log --since=<last run> --name-only -- handoff plan check scripts .githooks .claude .github`).
   Measure its size the same way the last run did, so the trend is comparable.
2. **Sections**, each a finding list with receipts or `[inferred]`:
   - **A. Requirement types / lanes** — does each lane's gate still catch what matters for it?
   - **B. Automate** — prose steps done by hand more than twice.
   - **C. Skills** — which exist, which are used, which are missing or stale.
   - **D. Improve / remove** — redundant or ossified machinery.
   - **E. Fix / correct** — stale or wrong statements now (paths, counts, rules contradicting each other).
   - **F. Holes and future risks.**
3. **Bottom line, Top 10** (impact/effort), and **Decisions for Emilio** — each phrased as a question with options.
4. Write `handoff/audits/workflow-<YYYY-MM-DD>.md`; commit with `./plan save` (L-032). Edit nothing else.
