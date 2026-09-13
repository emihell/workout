# Now

Updated 2026-09-13. **Shipped: req-01–09, req-11–23, req-25–31, req-33–63** (req-10 pending;
req-24 gated; req-32 dropped, DEC-025). Done lives in `log/SHIPPED.md`. Full
reqs: `work/req-*.md`; phased: `work/BACKLOG.md`. Keep under 50 lines.

## Milestone (Emilio, 2026-09-07)

> In-gym flow **flawless** first, then **program-creation**. Nothing heavy before the flow is flawless.

Phase 1 in-gym flow (now, browser-only) · Phase 2 program-creation · Phase 3 backend/users/exercise-DB/AI/styling (gated on the backend fork).

## Next — READY, held for Emilio's go (built via DEC-037 ephemeral-agent batches)

**2026-09-13 SHIPPED:** req-47/48 (row hierarchy, renames+marker) + req-51 (safe-area) + req-52 (bottom
menu) + req-53→**req-55** (in-progress: one-at-a-time, abandon-on-new, hero-replacement, stale→Continue/
Abandon; DEC-038, req-55 supersedes req-53's display) + req-54 (dock font) + **req-49** (logical back nav,
DEC-039) + **req-50** (components sweep, DEC-040) + **req-63** (demo phone-test gate, DEC-041) + **req-62**
(nav/action vocabulary, DEC-042). Emilio device/feel after-look owed (non-blocking); req-55 he eyed
pre-merge (persisted-data); req-62 he approved on the demo.

**READY, held:**
- `req-10` **first-time-exercise setup flow** — auto-prompt on a no-history exercise; never invents
  the first weight (DEC-012). Larger; needs flow design first. **[ux-feel]**

**Still decision-gated:** req-24 inline-confirm pattern, history-recalc behaviour, timed exercises #6 model.

## History (detail in SHIPPED / audits/2026-09-12.md)

Audit 2026-09-12 CLOSED 19/20 → req-46 (DEC-035). Tooling req-33/34/35. Refactor req-16–23; gym-flow
req-25–29. **#6 timed PARKED.** Emilio eyeballs owed (non-blocking): req-41 two-tab, req-44/25/27 gym feel.

## Needs decisions — parked until their phase

- **`req-24` native confirm/alert → inline UI** — 10 sites; needs the inline-confirm *pattern*
  first (bar/sheet vs two-tap vs undo). **[ux-feel]** Spec: `work/req-24-inline-confirm-alert.md`.
- **Backend fork** (gates Phase 3): browser-only vs database/server (+users, AI key). Decide first.
- **History recalc from a non-latest workout** (Phase 1) — see BACKLOG. **Program model** (Phase 2).

## Where to read

`PLANNING.md` (planning role + the two-agent build loop) → `work/BACKLOG.md` → `rules/DESIGN.md`
before UI/UX → `rules/WORKFLOW.md` for process → `rules/CLOSEOUT.md` to close a req. `README.md`
is the product contract.
