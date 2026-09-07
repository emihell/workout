# Now

Updated 2026-09-07 (req-03 READY). Keep under 50 lines; **done lives in `log/SHIPPED.md`**.
Full reqs: `work/req-*.md`; the phased plan: `work/BACKLOG.md`.

## Milestone (Emilio, 2026-09-07)

> In-gym flow **flawless** first. Then the **program-creation flow**. Nothing heavy before
> the flow is flawless.

```
Phase 1  in-gym flow flawless    ← now (browser-only)
Phase 2  program-creation flow   ← next
Phase 3  database+users, own exercise DB, animations, AI, full styling  (gated on the backend fork)
```

## Next — READY (all Phase 1; independent; build in any order)

- `req-01` **guard `saveState`** — persist path can throw and lose data silently; the safety floor. Banner on failure (DEC-001).
- `req-02` **carry kg+reps for a no-history exercise** — type it in set 1, follows the rest (DEC-002).
- `req-03` **persistent rest timer** — counter vanished when leaving the set screen; make it a workout-level bar, keep pause/resume/skip/+30s (DEC-003).

Each has a full spec in `work/`. Suggested order: `req-01` first (safety), then `02`/`03`.

## Needs decisions — parked until their phase

- **Backend fork** (gates all of Phase 3): browser-only vs a database/server? "Database" and
  "users" are one decision; an AI key can't live in a browser. Decide before any Phase-3 build.
- **History recalc from a non-latest workout** (Phase 1 behaviour) — see BACKLOG.
- **Program model** (Phase 2) — define program vs routine vs schedule before speccing.

## Gym-flow review (2026-09-07)

Done. Logic layer is sound; "flawless" is mostly a design pass on ~4 screens (app has **zero
CSS**) + rest-end cue/wake-lock + inline modals. Candidates in `work/BACKLOG.md` Phase 1.

## Where to read

`START-HERE.md` (read-order + close-out) → `work/BACKLOG.md` → `rules/DESIGN.md` before UI/UX →
`rules/WORKFLOW.md` for process. `README.md` is the product contract.
