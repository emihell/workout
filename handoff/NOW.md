# Now

Updated 2026-09-14. **Shipped: req-01–09, req-11–23, req-25–31, req-33–68** (req-10 pending;
req-24 gated; req-32 dropped, DEC-025). Done lives in `log/SHIPPED.md`. Full
reqs: `work/req-*.md`; phased: `work/BACKLOG.md`. Keep under 50 lines.

## ⛔ BLOCKING — do these first (Emilio, 2026-09-13 workflow review)

**MUST before any other work.** req-67/68 are planning's own (handoff/ edits, quick);
req-66 dispatches to the code session. Publish + build these before resuming product/other reqs.
Being worked as a serial batch (2026-09-14): each closed before the next, per DEC-035 batch mode.
- ✅ `req-65` **Reconcile CLAUDE.md's merge model with DEC-035** — SHIPPED 2026-09-14.
- ✅ `req-66` **Enforce --no-ff merges to main** — SHIPPED 2026-09-14. Approach A (pre-push guard);
  B proven impossible (DEC-045). Blocking batch complete.
- ✅ `req-67` **Make DECISIONS.md navigable** — SHIPPED 2026-09-14 (digest + 6 superseded markers).
- ✅ `req-68` **Name the two sessions Planner/Builder + [PLANNER]/[BUILDER] tags** — SHIPPED
  2026-09-14. Builder picks up `[BUILDER]` on its next turn (CLAUDE.md loads every turn).

**Open decision for Emilio (not a req — a direction):** the process weight. ~2,600 lines of
workflow machinery for a solo browser-only app, and this session shipped zero product (all meta).
Worth deciding whether to prune/consolidate the process, or accept it. Not spec'd — your call.

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
