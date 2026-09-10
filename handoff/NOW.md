# Now

Updated 2026-09-09. **Shipped: req-01–09, req-11, req-12** (all except req-10). req-06 merged — Emilio to
confirm phone data intact on next open. Done lives in `log/SHIPPED.md`. Full reqs: `work/req-*.md`;
phased: `work/BACKLOG.md`. Keep under 50 lines.

## Milestone (Emilio, 2026-09-07)

> In-gym flow **flawless** first. Then the **program-creation flow**. Nothing heavy before
> the flow is flawless.

```
Phase 1  in-gym flow flawless    ← now (browser-only)
Phase 2  program-creation flow   ← next
Phase 3  database+users, own exercise DB, animations, AI, full styling  (gated on the backend fork)
```

## Next — READY (all Phase 1; independent; build in any order)

Each req is tagged with its merge gate (DEC-009); only READY reqs (no open questions) enter the
autoloop.

- `req-10` **first-time-exercise setup flow** — auto-prompt "set it up / enter manually" on a no-history exercise; guided calibration reusing the effort→load-step rule, never invents the first weight (DEC-012). Larger; expect iteration. **[ux-feel → Emilio's hands before merge]**
- `req-13` **component library (+ showcase)** — extract every UI element into a minimal, colorless, tap-friendly, Apple-inspired primitive set + a `#/components` showcase to iterate on; no app migration yet (DEC-017). The styling foundation. **[ux-feel → Emilio's hands; expect iteration]**

Each has a full spec in `work/`. Code CC builds the one named above (or the one Emilio names) by
reading its `work/req-NN-*.md` — the spec lives there, not in a pasted prompt.

## Needs decisions — parked until their phase

- **`req-14` nav/menu redesign** — Emilio isn't a fan of req-13's placeholder menu; redesign it, but
  the *direction* (bottom tab bar / slide-up sheet / drawer / cleaner top menu) needs deciding first.
  Current menu stays meanwhile. `work/req-14-nav-menu-redesign.md`. **[ux-feel]**
- **Backend fork** (gates all of Phase 3): browser-only vs a database/server? "Database" and
  "users" are one decision; an AI key can't live in a browser. Decide before any Phase-3 build.
- **History recalc from a non-latest workout** (Phase 1 behaviour) — see BACKLOG.
- **Program model** (Phase 2) — define program vs routine vs schedule before speccing.

## Gym-flow review (2026-09-07)

Done. Logic layer is sound; "flawless" is mostly a design pass on ~4 screens (app has **zero
CSS**) + rest-end cue/wake-lock + inline modals. Candidates in `work/BACKLOG.md` Phase 1.

## Where to read

`PLANNING.md` (planning role + the two-agent build loop) → `work/BACKLOG.md` → `rules/DESIGN.md`
before UI/UX → `rules/WORKFLOW.md` for process → `rules/CLOSEOUT.md` to close a req. `README.md`
is the product contract.
