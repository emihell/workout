# Now

Updated 2026-09-14. **Shipped: req-01–09, req-11–23, req-25–31, req-33–75** (req-10 pending;
req-24 gated; req-32 dropped, DEC-025). Done lives in `log/SHIPPED.md`. Full
reqs: `work/req-*.md`; phased: `work/BACKLOG.md`. Keep under 50 lines.

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

**Gym-flow batch 2 (Emilio 2026-09-14, in-gym) — SAVED as req-76..86, NOT scheduled (tokens).**
Raw notes: BACKLOG N1–N11. READY (spec settled): req-76 Continue→current-exercise, req-79
done/not-done contrast, req-80 nav-to-bottom+inline-note, req-81 Today "Completed" dedupe. One-pick:
req-78 rest-pill-into-next-set (confirm remove rest view). PAUSED (Emilio 2026-09-16): req-77
active-workout affordance. NEEDS DECISION: req-82 empty-day Start, req-83 mid-workout value→default
(brushes core rule), req-84 auto-complete routine, req-85 timed exercises (model shape), req-86 dev note-capture.

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
