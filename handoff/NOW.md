# Now

Updated 2026-09-12. **Shipped: req-01–09, req-11–23, req-25–31, req-33–35** (req-10 pending; req-24
gated; req-32 dropped, DEC-025). Done lives in `log/SHIPPED.md`. Full reqs: `work/req-*.md`; phased:
`work/BACKLOG.md`. Keep under 50 lines.

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
  the first weight (DEC-012). Larger; needs flow design back-and-forth first. **[ux-feel]**

**Workflow/tooling (SHIPPED 2026-09-12, `8daa8f2`):** `req-33` `plan doctor`, `req-34` gate holes
(CI runs `./check`; test glob recurses), `req-35` narrow push grant (README slice). DEC-026/027.
Grants stay machine-local (DEC-028; tracking tried+reverted, F-CONFIG-1) — `settings.local.json`
recreated, `plan doctor` green.

## Audit 2026-09-12 → req queue (`audits/2026-09-12.md`)

20 findings; F-CONFIG-1 fixed (DEC-028). Decisions taken: DEC-029..033. **Trust bugs first**
(persisted-data → Emilio's hands, DEC-009): corrupt-`v8` guard (F-RISK-2/DEC-032), v5 migration
test + pin shape (F-RISK-1), UTC→local date key (F-CODE-2), backup array-validation (F-RISK-4),
progression unify Finish==recalc (F-CODE-1). **Then:** cross-tab warn (F-RISK-3/DEC-029), n/a-step
holds (F-DIV-1/DEC-030), archive confirm names slots (F-DIV-3/DEC-031). **Cleanup:** drop
`nextScheduled`, dedupe predicates, split `model.js`/`item.jsx`, `plan doctor` content-check.
**Planning-owned (no code):** populate `reference/`, note DEC-002 carry in DESIGN §1, "Correct" kept
(DEC-033). Reqs specced one at a time from here.

**Still decision-gated:** req-24 inline-confirm pattern, history-recalc behaviour, timed exercises #6 model.

**Done batches:** refactor (req-16–23, DEC-021; #8 no-op, #10 rejected); gym-flow notes (req-25–29,
DEC-009-refinement auto-merge). Emilio to gym-test req-25/27 feel. Audit 2026-09-11 (in code
`audits/`) → req-30 (F1/F2) shipped, F3 skipped. **#6 timed exercises PARKED** (model TBD; a
"Duration" field already exists for cardio, e.g. Rowing).

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
