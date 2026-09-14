# req-70 — Reconcile the remaining merge-gate drift to DEC-035

**Status: SHIPPED 2026-09-14** — planning-owned, published to `main` (no code branch). First step
of the workflow-audit follow-up (`audits/workflow-2026-09-14.md`); correctness (same class as
req-65/69). Done before req-71 (consolidation) so every doc is at least *correct* before restructure.

## Why

DEC-035 (planning tests everything reachable and merges on that; only carve-outs are
migration/bulk-rewrite → Emilio, shared-code → independent reviewer) is the live rule.
req-65/69 fixed `CLAUDE.md` and `WORKFLOW.md`'s Branching section, but the audit found **9 stale
spots + 2 self-contradictions** still teaching the pre-DEC-035 DEC-009 "Emilio uses it before
merge" gate — concentrated in the 3 docs the DEC-035 pass missed. The worst, `PLANNING.md:44-48`
("Never merge on green tests alone"), is the *direct opposite* of DEC-035 and of how Planner just
operated (reqs 65/67/68/69 merged on Planner's own testing). Live-wrong guidance in Planner's own
guide.

## Scope — fix each to DEC-035 (audit §2, verified 2026-09-14)

- `PLANNING.md` — the "merge is yours after use-it OK (DEC-006)" block (~:44); the stale batch
  paragraph that contradicts the DEC-035 batch rule above it (~:258); the "use-it gate for
  UX/persisted-data" residue in the hand-to-Emilio lists (~:319, ~:359, ~:365); the "Feel/UX —
  not the planning session's to close" line (~:438).
- `rules/WORKFLOW.md` — the "Reviewing a branch" checklist item 5 "Emilio uses it… the merge
  gate" (~:159), which also contradicts the same file's current Branching section (:216-220).
- `rules/CLOSEOUT.md` — the preamble (:3-8) teaching the DEC-009 per-kind gate; cite DEC-035.
- `work/BACKLOG.md` — mark the "per-branch preview deploy (cloud)" item superseded-in-part by
  DEC-041 (the audit notes it carries no marker though DEC-041 explicitly supersedes it for
  Emilio's own testing; the planning-can't-browser-verify motivation partly survives).

Everywhere: the untestable real-device feel is felt by Emilio **after** merge and does **not**
block; the two carve-outs are the only pre-merge human/reviewer gates. Reference DEC-035; do not
restate it in full (that is req-71's consolidation job).

## Out of scope

- Consolidation / single-homing (req-71). This req only makes the stale text *correct*, in place.
- `PLANNING.md:234` (migration carve-out) and `WORKFLOW.md:220` (independent reviewer) — already
  correct under DEC-035; leave them.

## Acceptance

- `grep -nE "green tests alone|Emilio uses it|use-it OK \(DEC-006\)|needs Emilio's OK first|not the
  planning session's to close" handoff/PLANNING.md handoff/rules/WORKFLOW.md handoff/rules/CLOSEOUT.md`
  → no live stale-gate phrasing remains (quote before/after).
- No doc still teaches a human use-gate as *the* merge gate; each reconciled spot references
  DEC-035 or the carve-outs. `check_handoff` passes.
- The BACKLOG preview-deploy item carries a DEC-041 superseded-in-part marker.
