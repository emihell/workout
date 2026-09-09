# Now

Updated 2026-09-09. **Shipped: req-01, req-03, req-05** (see `log/SHIPPED.md`). Keep under 50
lines; done lives in `log/SHIPPED.md`. Full reqs: `work/req-*.md`; phased plan: `work/BACKLOG.md`.

## Milestone (Emilio, 2026-09-07)

> In-gym flow **flawless** first. Then the **program-creation flow**. Nothing heavy before
> the flow is flawless.

```
Phase 1  in-gym flow flawless    ← now (browser-only)
Phase 2  program-creation flow   ← next
Phase 3  database+users, own exercise DB, animations, AI, full styling  (gated on the backend fork)
```

## Next — READY (all Phase 1; independent; build in any order)

**→ Next up: `req-02`** (recommended — continues the in-gym flow). `req-06` is the best pure-logic
loop candidate (tests fully cover it, no human gate needed to close).

- `req-02` **carry kg+reps for a no-history exercise** — type it in set 1, follows the rest (DEC-002).
- `req-06` **legacy-key cleanup** — remove `workout-mvp-v5..v7` after the v8 write is confirmed persisted (read-back gate); failed/silent save never deletes the legacy copy. (persisted-data)
- `req-07` **backup before a destructive import** — auto-download current state before `applyBackup` replaces it (DEC-004); one shared helper for both import sites. (persisted-data)
- `req-04` **deploy only on build changes** — planning publishes currently redeploy the live app for nothing; filter the Pages trigger to build inputs. (infra)

Each has a full spec in `work/`. Code CC builds the one named above (or the one Emilio names) by
reading its `work/req-NN-*.md` — the spec lives there, not in a pasted prompt.

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
