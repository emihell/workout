# Now

Updated 2026-10-30. **Shipped: everything through req-248** (batch 7 complete with req-244) except req-32 (dropped), req-77 (PAUSED), req-246 (withdrawn) and
the reqs below — `log/SHIPPED.md`. Reqs `work/req-*.md`; open items `work/BACKLOG.md`. ≤50 lines.

## Milestone (Emilio, 2026-09-07)

> In-gym flow **flawless** first, then **program-creation**. Nothing heavy before the flow is flawless.

Phase 1 in-gym flow (now) · Phase 2 program-creation · Phase 3 other users / training together / AI (req-146 stages 2–3).

## Where things stand (2026-10-30)

- **Nothing in flight.** No branch open, no agent running; the Builder session is being shut down (Emilio). Code + planning
  worktrees on `main`/`planning` at `2acb12f`, clean; old agent worktrees and merged branches removed.
- **Live = `2acb12f`** (req-239..243 included), deployed 2026-10-30 00:01, `doctor: all ok`; CI run 40970092841 green.
  Server `https://macbookpro-intel-2017.tail58ea74.ts.net:8446` (stage 1 done, DEC-127..136, DEC-143).
- **First finished workout synced** [measured, read-only]: 2026-10-28 11:16–11:52, 25 sets (rev 53; 24 workouts). Go-live is
  fully proven. **Next for the coach (DEC-140/141):** review that workout against run 3 (`coach/COACH.md`).
- **Backups:** weekly agent loaded, exit 0; newest scheduled backup 10-26 09:00; the next is due ≥ 11-02 (7 days). Confirm it fires.
- **Feedback notes:** server `notes` table, 0 rows (2026-10-30).
- **Working agreement (L-060, DEC-143):** a team, not orders — Planner weighs and pushes back. Merged ≠ live: deploy after any
  served change (CLOSEOUT step 4, L-063). Batches → throwaway agents (DEC-055).

**Batch 7 done:** req-244 (GO pill, two lines) merged + deployed 2026-10-30 — the batch's last req.

**Planner's recommended order (not yet agreed by Emilio):** a real gym session on the new build → coach review → a small
tooling batch (BACKLOG §Tooling) → re-check the old review issues (BACKLOG §Phase 1) → Phase 2. Planner also proposed a lighter
path for copy/comment-only reqs (tests + one SHIPPED line) — open.

**Emilio's calls, any time:** loop-length re-anchor; import sheet highlight (Keep vs Replace); missed rep lowers one set even
on Easy; Change-exercise type carry-over (req-242); req-239/240/242/243 copy `(unconfirmed)`; timer runs once per side (req-240);
"Ex" vs "Exercise" and what N counts in the pill (req-244, BACKLOG §Phase 1).

## Needs decisions — parked until their phase

- req-149 progression rules (Emilio, DEC-075).
- req-184 creation design session 2: the program model (Phase 2).
- req-146 stages 2–3: accounts, sharing, privacy, AI cost (Phase 3).

## Where to read

`PLANNING.md` (planning role + the two-agent build loop) → `reference/PAGES.md` for page feedback (DEC-137) → `work/BACKLOG.md` → `rules/DESIGN.md`
before UI/UX → `rules/WORKFLOW.md` for process → `rules/CLOSEOUT.md` to close a req → `rules/BACKEND.md` for the server.
`README.md` is the product contract.
