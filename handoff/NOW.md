# Now

Updated 2026-09-23. **Shipped: req-01–09, req-11–23, req-25–31, req-33–108, req-110–111, req-109, req-112–113, req-115, req-114, req-120, req-118, req-116–117, req-119, req-121–128** (req-10 pending; req-24
gated; req-32 dropped; req-77 PAUSED). **Gym-flow batch 4 LIVE 2026-09-23:** Emilio's feedback JSON
(F1..F10) → req-103..111, plus req-112 (Finish no longer rewrites the routine, DEC-056). DEC-052..057, L-022/023.
**Owed by Emilio:** the batch-4 on-device test list (`work/BACKLOG.md` §batch 4, 12 items); older: batch-3 feel
(pill overlap, iPhone no-zoom, beat-line wording, Timed discoverability).
`log/SHIPPED.md`; reqs `work/req-*.md`; index `work/BACKLOG.md`. ≤50 lines.

## Milestone (Emilio, 2026-09-07)

> In-gym flow **flawless** first, then **program-creation**. Nothing heavy before the flow is flawless.

Phase 1 in-gym flow (now, browser-only) · Phase 2 program-creation · Phase 3 backend/users/exercise-DB/AI/styling (gated on the backend fork).

## Next — READY, held for Emilio's go (batches → throwaway agents, DEC-055)

**Nothing in flight.** **Flow audit 2026-09-23: Tier 1 (req-114..120) and Tier 2 (req-121..123) LIVE**; Tier 3 in `BACKLOG.md` §Flow audit.

**READY, held:**
- `req-128`, `req-129` **flow-audit Tier 3** (DEC-059; 124–127 LIVE): 126 weight
  step · 127 names/Restore/guards · 128 small leftovers · 129 planning tooling. **Batch approved** — Emilio: "lets do
  t3" (2026-09-23). [P] 124–128 → reviewer + backup reminder. Specs revised after review. Backup: "exported before, go".
- `req-10` **first-time-exercise setup flow** — auto-prompt on a no-history exercise; never invents
  the first weight (DEC-012). Larger; needs flow design first. **[ux-feel]**

**Gym-flow batch 2 (req-76..86): all LIVE except `req-77` (PAUSED — affordance; folds in n1 Finish/Abandon).**

## Needs decisions — parked until their phase

- **`req-24` native confirm/alert → inline UI** — 10 sites; needs the inline-confirm *pattern*
  first (bar/sheet vs two-tap vs undo). **[ux-feel]** Spec: `work/req-24-inline-confirm-alert.md`.
- **Backend fork** (gates Phase 3): browser-only vs database/server (+users, AI key). Decide first.
- **History recalc from a non-latest workout** (Phase 1) — see BACKLOG. **Program model** (Phase 2).

## Where to read

`PLANNING.md` (planning role + the two-agent build loop) → `work/BACKLOG.md` → `rules/DESIGN.md`
before UI/UX → `rules/WORKFLOW.md` for process → `rules/CLOSEOUT.md` to close a req. `README.md`
is the product contract.
