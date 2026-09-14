# req-72 — Fit adaptations from the workflow audit

**Status: SHIPPED 2026-09-14** — planning-owned, published to `main`. Workflow-audit follow-up #3
(`audits/workflow-2026-09-14.md` §3 NEEDS-ADAPTATION).
Planner-owned. On inspection, two of the three audit-flagged adaptations are already-handled or
cross-domain; this req delivers the one that is safe and planning-domain, and records the other two
honestly rather than manufacturing churn (the audit itself rated the machinery "mostly EARNS-KEEP").

## What the audit flagged, and the honest disposition

1. **Independent-reviewer *doctrine* was heavier than the payoff.** → **Already delivered by req-71:**
   the operational statement in `PLANNING.md` is now trimmed to the trigger + skip-for-trivial, and the
   full doctrine lives in **DEC-035** (append-only — not rewritten). No further action.
2. **6-state readiness taxonomy is more states than one person needs.** → **Deferred, cross-domain.**
   `scripts/check_handoff.py` (`:220-248`) validates these exact tags (READY / NEEDS DECISIONS /
   BLOCKED / SHELVED / WITHDRAWN / BUILT-MERGED); slimming them means editing that script = **Builder's
   domain**, for marginal benefit on a 7-line block that works. Recorded as an optional future Builder
   req, not done here.
3. **Per-req paperwork is thick for reversible tweaks.** → **Done here.** The one safe, valuable,
   planning-domain adaptation.

## Scope (item 3 only)

- `CLAUDE.md` report mandate (§"How work arrives"): keep the two-section (Technical + Workflow) report,
  but add that a **trivial/mechanical req gets a brief report** — each section can be a line or two; the
  point is signal, not volume; never pad, and never drop a real deviation from the Workflow section.
  (Safe: `check_handoff.py`'s "sections" check targets BACKLOG's index, not report structure —
  verified 2026-09-14.)

## Out of scope

- The readiness-taxonomy slim (item 2 — Builder-domain, deferred). The reviewer-doctrine (item 1 —
  done by req-71). Any `check_handoff.py` / `plan` change.

## Acceptance

- `CLAUDE.md` states the report may be sized to the req (trivial → brief, both sections kept). Quote it.
- No taxonomy/tag change; `check_handoff` still passes.
