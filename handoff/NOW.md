# Now

Updated 2026-09-23. **Shipped: req-01–09, req-11–23, req-25–31, req-33–108, req-110–111, req-109, req-112–113, req-115, req-114** (req-10 pending; req-24
gated; req-32 dropped; req-77 PAUSED). **Gym-flow batch 4 LIVE 2026-09-23:** Emilio's feedback JSON
(F1..F10) → req-103..111, plus req-112 (Finish no longer rewrites the routine, DEC-056). DEC-052..057, L-022/023.
**Owed by Emilio:** the batch-4 on-device test list (`work/BACKLOG.md` §batch 4, 12 items); older: batch-3 feel
(pill overlap, iPhone no-zoom, beat-line wording, Timed discoverability).
`log/SHIPPED.md`; reqs `work/req-*.md`; index `work/BACKLOG.md`. ≤50 lines.

## Milestone (Emilio, 2026-09-07)

> In-gym flow **flawless** first, then **program-creation**. Nothing heavy before the flow is flawless.

Phase 1 in-gym flow (now, browser-only) · Phase 2 program-creation · Phase 3 backend/users/exercise-DB/AI/styling (gated on the backend fork).

## Next — READY, held for Emilio's go (batches → throwaway agents, DEC-055)

**Nothing in flight.** **Flow audit 2026-09-23** found 34 new issues → `BACKLOG.md` §Flow audit (Tier 1 A–G, 4 calls for Emilio).

**READY, held:**
- `req-114`..`req-120` **flow-audit Tier 1** (DEC-058; specs reviewed + revised 2026-09-23): 114 dates/Today ·
  115 safe import · 116 Finish nav · 117 undoable taps · 118 routine-editor parsing · 119 setup vs live · 120 no
  invented plan on load. Order **115, 114 (LIVE), 120,118,116,117,119**. All but 118 [P] → reviewer + backup (DEC-057);
  120 = migration → Emilio sees the diff.
  **Batch approved** — Emilio: "go" (2026-09-23, after the list above). Backup export: confirmed ("yes").
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
