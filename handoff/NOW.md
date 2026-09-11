# Now

Updated 2026-09-11. **Shipped: req-01–09, req-11–13, req-15–23, req-25–30** (all except req-10). Done
lives in `log/SHIPPED.md`. Full reqs: `work/req-*.md`; phased: `work/BACKLOG.md`. Keep under 50 lines.

## Milestone (Emilio, 2026-09-07)

> In-gym flow **flawless** first. Then the **program-creation flow**. Nothing heavy before
> the flow is flawless.

```
Phase 1  in-gym flow flawless    ← now (browser-only)
Phase 2  program-creation flow   ← next
Phase 3  database+users, own exercise DB, animations, AI, full styling  (gated on the backend fork)
```

## Next — READY

- `req-10` **first-time-exercise setup flow** — auto-prompt on a no-history exercise; never invents
  the first weight (DEC-012). Larger; expect iteration. **[ux-feel → Emilio's hands before merge]**

**Done batches:** refactor (req-16–23, DEC-021; #8 no-op, #10 rejected); gym-flow notes (req-25–29,
DEC-009-refinement auto-merge). Emilio to gym-test req-25/27 feel. Audit 2026-09-11 (in code
`audits/`) → req-30 (F1/F2) shipped, F3 skipped. **#6 timed exercises PARKED** (model TBD; a
"Duration" field already exists for cardio, e.g. Rowing).

## Needs decisions — parked until their phase

- **`req-24` native confirm/alert → inline UI** (from req-15 finding #11) — 10 sites; needs the
  inline-confirm *pattern* decided first (bar/sheet vs two-tap vs undo). **[ux-feel]** Spec: `work/req-24-inline-confirm-alert.md`.
- **`req-14` nav/menu redesign** — Emilio isn't a fan of req-13's placeholder menu; redesign it, but
  the *direction* (bottom tab bar / slide-up sheet / drawer / cleaner top menu) needs deciding first.
  Current menu stays meanwhile. `work/req-14-nav-menu-redesign.md`. **[ux-feel]**
- **Backend fork** (gates all of Phase 3): browser-only vs a database/server? "Database" and
  "users" are one decision; an AI key can't live in a browser. Decide before any Phase-3 build.
- **History recalc from a non-latest workout** (Phase 1 behaviour) — see BACKLOG.
- **Program model** (Phase 2) — define program vs routine vs schedule before speccing.

## Where to read

`PLANNING.md` (planning role + the two-agent build loop) → `work/BACKLOG.md` → `rules/DESIGN.md`
before UI/UX → `rules/WORKFLOW.md` for process → `rules/CLOSEOUT.md` to close a req. `README.md`
is the product contract.
