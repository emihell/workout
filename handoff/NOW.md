# Now

Updated 2026-09-16. **Shipped: req-01–09, req-11–23, req-25–31, req-33–76, req-78–83, req-86–87** (req-10
pending; req-24 gated; req-32 dropped; req-77 PAUSED). Batch 3 done; **req-87** (feedback notes → live
site, Settings toggle, default off) merged after. Next: req-84 auto-complete + req-85 timed — both
DECIDED, spec-pending (Planner owes the specs). **Decided, spec-pending (not buildable yet):** req-84 auto-complete (+vs-last stats),
req-85 timed exercises (schema bump — Emilio's eyes + backup-first). **Batch 2 after-batch pass still owed
by Emilio:** req-78 req-25 Previous-then-forward browser check + confirm the 2 req-78 removals (DEC-048).
Done: `log/SHIPPED.md`. Full reqs: `work/req-*.md`; phased: `work/BACKLOG.md`. Keep under 50 lines.

**Cleared 2026-09-14 (serial batch, DEC-035):** req-65–69 — CLAUDE.md merge model, pre-push
`--no-ff` guard (DEC-045), DECISIONS digest, Planner/Builder tags, `plan doctor` fix. Detail in SHIPPED.

## ✅ Workflow audit follow-up CLEARED (Emilio: "deal with workflow first" → shipped 2026-09-14)

Audited on facts (`handoff/audits/workflow-2026-09-14.md`): verdict = **drift + volume, not cruft**. All merged
(reqs 70–75): merge-gate drift reconciled, docs consolidated to one-home-per-rule (reviewer PASS, merge gate
can't drift again), report sized-to-req, gaps filled, `from [PLANNER]`/`from [BUILDER]` tags live, migration
reference (schema.md) refreshed. **DEC-045** (`--no-ff` guard), **DEC-046** (backup-before-migration). Detail: SHIPPED.

## Milestone (Emilio, 2026-09-07)

> In-gym flow **flawless** first, then **program-creation**. Nothing heavy before the flow is flawless.

Phase 1 in-gym flow (now, browser-only) · Phase 2 program-creation · Phase 3 backend/users/exercise-DB/AI/styling (gated on the backend fork).

## Next — READY, held for Emilio's go (built via DEC-037 ephemeral-agent batches)

**READY, held:**
- `req-10` **first-time-exercise setup flow** — auto-prompt on a no-history exercise; never invents
  the first weight (DEC-012). Larger; needs flow design first. **[ux-feel]**

**Gym-flow batch 2 (Emilio 2026-09-14) — req-76..86** (raw: BACKLOG N1–N11). In flight this session
(order at top); req-78 decided 2026-09-16 (remove rest view, self-paced, build last). PAUSED: req-77
affordance. NEEDS DECISION: req-82 empty-day Start, req-83 mid-workout value→default (brushes core
rule), req-84 auto-complete, req-85 timed (model shape), req-86 dev note-capture.

**Still decision-gated:** req-24 inline-confirm pattern; history-recalc behaviour; req-82/83/84/85/86 (above).

## Needs decisions — parked until their phase

- **`req-24` native confirm/alert → inline UI** — 10 sites; needs the inline-confirm *pattern*
  first (bar/sheet vs two-tap vs undo). **[ux-feel]** Spec: `work/req-24-inline-confirm-alert.md`.
- **Backend fork** (gates Phase 3): browser-only vs database/server (+users, AI key). Decide first.
- **History recalc from a non-latest workout** (Phase 1) — see BACKLOG. **Program model** (Phase 2).

## Where to read

`PLANNING.md` (planning role + the two-agent build loop) → `work/BACKLOG.md` → `rules/DESIGN.md`
before UI/UX → `rules/WORKFLOW.md` for process → `rules/CLOSEOUT.md` to close a req. `README.md`
is the product contract.
