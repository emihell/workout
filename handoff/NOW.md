# Now

Updated 2026-09-13. **Shipped: req-01–09, req-11–23, req-25–31, req-33–46** (req-10 pending; req-24
gated; req-32 dropped, DEC-025). Done lives in `log/SHIPPED.md`. Full reqs: `work/req-*.md`; phased:
`work/BACKLOG.md`. Keep under 50 lines.

## Milestone (Emilio, 2026-09-07)

> In-gym flow **flawless** first, then **program-creation**. Nothing heavy before the flow is flawless.

Phase 1 in-gym flow (now, browser-only) · Phase 2 program-creation · Phase 3 backend/users/exercise-DB/AI/styling (gated on the backend fork).

## Next — UI/UX batch (Emilio 2026-09-13). Spec all → push → build the quick ones → hold the heavy.

**Quick (batch-build now, low-impact):**
- `req-47` **Workout-page row hierarchy** — date stacked above info (caption font); today black,
  other dates gray; today block untouched. **[ux-feel]**
- `req-48` **Rename Future→Schedule / Past→History + Schedule today-marker.** **[ux-feel]**

**Heavy (hold — Emilio waits for these):**
- `req-49` **Logical back nav** — Back→logical parent, not last-visit (one `Back`, ~35 sites; root
  cause: `route.js` visit-stack). Touches shared route/helper → reviewer subagent before merge. **[functional]**
- `req-50` **Components sweep** — no bare text links; nav→NavLink, action→Button. Order after req-49. **[ux-feel]**
- `req-51` **iPhone safe-area + a11y** — menu clips in full-screen; root cause [measured]: no
  `viewport-fit=cover` → `env(safe-area-*)`=0. Real-device look is Emilio's after-check. **[ux-feel]**
- `req-52` **Bottom menu redesign** — **NEEDS DECISIONS**: mock variants first, then spec. **[ux-feel]**

- `req-10` **first-time-exercise setup flow** — auto-prompt on a no-history exercise; never invents
  the first weight (DEC-012). Larger; needs flow design first. **[ux-feel]**

**Still decision-gated:** req-24 inline-confirm pattern, history-recalc behaviour, timed exercises #6 model.

## History (detail in SHIPPED / audits/2026-09-12.md)

Audit 2026-09-12 CLOSED 19/20 (req-36–45 + F-CONFIG-1; only F-STRUCT-4 deferred) → req-46 (DEC-035).
Tooling req-33/34/35 (DEC-028). Refactor req-16–23 (DEC-021); gym-flow req-25–29. **#6 timed PARKED.**
Emilio eyeballs owed (non-blocking): req-41 two-tab, req-44/25/27 gym feel.

## Needs decisions — parked until their phase

- **`req-24` native confirm/alert → inline UI** — 10 sites; needs the inline-confirm *pattern*
  first (bar/sheet vs two-tap vs undo). **[ux-feel]** Spec: `work/req-24-inline-confirm-alert.md`.
- **Backend fork** (gates Phase 3): browser-only vs database/server (+users, AI key). Decide first.
- **History recalc from a non-latest workout** (Phase 1) — see BACKLOG. **Program model** (Phase 2).

## Where to read

`PLANNING.md` (planning role + the two-agent build loop) → `work/BACKLOG.md` → `rules/DESIGN.md`
before UI/UX → `rules/WORKFLOW.md` for process → `rules/CLOSEOUT.md` to close a req. `README.md`
is the product contract.
