# Now

Updated 2026-09-12. **Shipped: req-01–09, req-11–23, req-25–31, req-33–38** (req-10 pending; req-24
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

## Audit 2026-09-12 → req queue (`audits/2026-09-12.md`, 20 findings)

Decisions DEC-028..033 taken; planning-side done (`reference/schema.md`, DESIGN §1 carry, "Correct").
**Trust bugs first** (persisted-data → Emilio's hands): corrupt-`v8` (DEC-032), v5 migration test,
UTC→local date, backup validation, progression unify. **Then:** cross-tab warn (DEC-029), n/a holds
(DEC-030), archive names slots (DEC-031). **Cleanup:** dead code, dedupe, split `model.js`/`item.jsx`,
doctor content-check. Reqs specced one at a time. **req-36/37/38 shipped**; **building now: `req-39`** (backup array-validation). L-007: store.jsx not unit-testable (no JSX transform) → put logic in pure modules.

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
