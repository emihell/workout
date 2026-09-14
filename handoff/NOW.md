# Now

Updated 2026-09-14. **Shipped: req-01–09, req-11–23, req-25–31, req-33–70** (req-10 pending;
req-24 gated; req-32 dropped, DEC-025). Done lives in `log/SHIPPED.md`. Full
reqs: `work/req-*.md`; phased: `work/BACKLOG.md`. Keep under 50 lines.

## ✅ Blocking batch CLEARED (2026-09-13 workflow review → shipped 2026-09-14)

Serial batch, each closed before the next (DEC-035 batch mode). All merged:
req-65 (CLAUDE.md merge model → DEC-035) · req-66 (pre-push `--no-ff` guard; approach A,
DEC-045) · req-67 (DECISIONS.md digest + superseded markers) · req-68 (Planner/Builder names
+ tags, now live) · req-69 (follow-ups: WORKFLOW.md stale gate + `plan doctor` false hooks-FIX).

## Workflow audit follow-up (Emilio: "deal with workflow/planning first", 2026-09-14)

Audited on facts (`audits/workflow-2026-09-14.md`): verdict = **drift + volume, not cruft**;
machinery mostly fits. Emilio said "do it" — being worked as a serial batch:
- ✅ `req-70` **Reconcile merge-gate drift** — SHIPPED. 9 stale spots + 2 self-contradictions → DEC-035.
- `req-71` **Consolidate to one-home-per-rule** — NEXT. ~15 multi-homed rules → single home +
  cross-refs; est. −250–350 restatement lines. Shared-doc blast radius → independent reviewer pre-merge.
- `req-72` **Fit adaptations** — trim reviewer *doctrine* (keep tool), slim readiness taxonomy, lighten
  per-req paperwork. Some judgment calls for Emilio.
- `req-73` **Gaps** — backup-discipline standing rule (open policy Q for Emilio), log-pruning cadence,
  periodic workflow-refit step, `reference/migration.md`.

## Milestone (Emilio, 2026-09-07)

> In-gym flow **flawless** first, then **program-creation**. Nothing heavy before the flow is flawless.

Phase 1 in-gym flow (now, browser-only) · Phase 2 program-creation · Phase 3 backend/users/exercise-DB/AI/styling (gated on the backend fork).

## Next — READY, held for Emilio's go (built via DEC-037 ephemeral-agent batches)

**READY, held:**
- `req-10` **first-time-exercise setup flow** — auto-prompt on a no-history exercise; never invents
  the first weight (DEC-012). Larger; needs flow design first. **[ux-feel]**

**Still decision-gated:** req-24 inline-confirm pattern, history-recalc behaviour, timed exercises #6 model.

## Needs decisions — parked until their phase

- **`req-24` native confirm/alert → inline UI** — 10 sites; needs the inline-confirm *pattern*
  first (bar/sheet vs two-tap vs undo). **[ux-feel]** Spec: `work/req-24-inline-confirm-alert.md`.
- **Backend fork** (gates Phase 3): browser-only vs database/server (+users, AI key). Decide first.
- **History recalc from a non-latest workout** (Phase 1) — see BACKLOG. **Program model** (Phase 2).

## Where to read

`PLANNING.md` (planning role + the two-agent build loop) → `work/BACKLOG.md` → `rules/DESIGN.md`
before UI/UX → `rules/WORKFLOW.md` for process → `rules/CLOSEOUT.md` to close a req. `README.md`
is the product contract.
