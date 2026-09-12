# Now

Updated 2026-09-12. **Shipped: req-01–09, req-11–23, req-25–31, req-33–46** (req-10 pending; req-24
gated; req-32 dropped, DEC-025). Done lives in `log/SHIPPED.md`. Full reqs: `work/req-*.md`; phased:
`work/BACKLOG.md`. Keep under 50 lines.

## Milestone (Emilio, 2026-09-07)

> In-gym flow **flawless** first, then **program-creation**. Nothing heavy before the flow is flawless.

Phase 1 in-gym flow (now, browser-only) · Phase 2 program-creation · Phase 3 backend/users/exercise-DB/AI/styling (gated on the backend fork).

## Next — READY

- `req-10` **first-time-exercise setup flow** — auto-prompt on a no-history exercise; never invents
  the first weight (DEC-012). Larger; needs flow design back-and-forth first. **[ux-feel]**

**Tooling (SHIPPED 2026-09-12):** req-33/34/35. Grants stay machine-local (DEC-028; tracking
tried+reverted, F-CONFIG-1) — `plan doctor` green.

## Audit 2026-09-12 — CLOSED (`audits/2026-09-12.md`)

20 findings → 19 resolved: F-CONFIG-1 + req-36–45 (5 trust bugs, 3 behaviour reqs, cleanup dedupe, doctor
content-check) all shipped. New: DEC-028..034, L-007/008, `reference/schema.md`. **Only F-STRUCT-4
(model.js/item.jsx module splits) deferred** — low-value, higher risk; revive if wanted. Non-blocking
Emilio eyeballs: req-41 two-tab, req-44 gym-flow walk.

**Post-audit reflection → `req-46` SHIPPED:** save-time drift warning, `plan publish --push`,
`plan closeout` checklist. DEC-035 (planning merges on own testing; runs are batch/single). PLANNING.md +
BACKLOG (preview deploy) patched. **Nothing building — queue empty.**

**Still decision-gated:** req-24 inline-confirm pattern, history-recalc behaviour, timed exercises #6 model.

**Done batches:** refactor (req-16–23, DEC-021); gym-flow notes (req-25–29). Emilio to gym-test
req-25/27 feel. **#6 timed exercises PARKED** (model TBD; cardio "Duration" exists, e.g. Rowing).

## Needs decisions — parked until their phase

- **`req-24` native confirm/alert → inline UI** (from req-15 finding #11) — 10 sites; needs the
  inline-confirm *pattern* decided first (bar/sheet vs two-tap vs undo). **[ux-feel]** Spec: `work/req-24-inline-confirm-alert.md`.
- **Backend fork** (gates all of Phase 3): browser-only vs a database/server? "Database" and
  "users" are one decision; an AI key can't live in a browser. Decide before any Phase-3 build.
- **History recalc from a non-latest workout** (Phase 1 behaviour) — see BACKLOG.
- **Program model** (Phase 2) — define program vs routine vs schedule before speccing.

## Where to read

`PLANNING.md` (planning role + the two-agent build loop) → `work/BACKLOG.md` → `rules/DESIGN.md`
before UI/UX → `rules/WORKFLOW.md` for process → `rules/CLOSEOUT.md` to close a req. `README.md`
is the product contract.

<!-- req-46 #1 positive test — throwaway drift, removed next commit -->
<!-- line -->
<!-- line -->
<!-- line -->
