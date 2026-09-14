# Now

Updated 2026-09-14. **Shipped: req-01–09, req-11–23, req-25–31, req-33–72** (req-10 pending;
req-24 gated; req-32 dropped, DEC-025). Done lives in `log/SHIPPED.md`. Full
reqs: `work/req-*.md`; phased: `work/BACKLOG.md`. Keep under 50 lines.

**Cleared 2026-09-14 (serial batch, DEC-035):** req-65–69 — CLAUDE.md merge model, pre-push
`--no-ff` guard (DEC-045), DECISIONS digest, Planner/Builder tags, `plan doctor` fix. Detail in SHIPPED.

## Workflow audit follow-up (Emilio: "deal with workflow/planning first", 2026-09-14)

Audited on facts (`audits/workflow-2026-09-14.md`): verdict = **drift + volume, not cruft**;
machinery mostly fits. Emilio said "do it" — being worked as a serial batch:
- ✅ `req-70` **Reconcile merge-gate drift** — SHIPPED. 9 stale spots + 2 self-contradictions → DEC-035.
- ✅ `req-71` **Consolidate to one-home-per-rule** — SHIPPED. Merge gate single-homed to DEC-035
  (drift can't recur); −51 lines; independent-reviewer PASS.
- ✅ `req-72` **Fit adaptations** — SHIPPED. Report sized-to-req (CLAUDE.md); reviewer-doctrine already
  done (req-71); taxonomy-slim deferred (Builder/check_handoff coupling).
- `req-73` **Gaps** — backup-discipline standing rule (unconfirmed default for Emilio), log-pruning
  cadence, periodic workflow-refit step, `reference/migration.md`.
- `req-74` **Tag fix** — cross-session messages prefix `from [PLANNER]`/`from [BUILDER]` (own-window
  messages stay `[PLANNER]`/`[BUILDER]`); req-68 refinement (Emilio, 2026-09-14).

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
