# Now

Updated 2026-10-31. **Shipped: everything through req-253** (batch 7 complete; the workflow update req-249..252 merged + deployed; req-253 tooling) except req-32 (dropped), req-77 (PAUSED), req-246 (withdrawn) and
the reqs below — `log/SHIPPED.md`. Reqs `work/req-*.md`; open items `work/BACKLOG.md`. ≤50 lines.

**Next:** Coach review 2026-10-31 → DEC-146..148: brief split (COACH · GOALS · LESSONS), CAPABILITIES gained how a plan runs
in the workout; `EVIDENCE.md` in progress (research agent → Emilio reviews). Next Coach run (server Mac): move LESSONS'
last section into `CLIENT.md`; rebuild run 4's `import.json` (supersets in notes, DEC-146); the 10-30 barbell session after
Emilio's 4 answers (`CLIENT.md` §New). Then spec the plan-builder (BACKLOG §Tooling).

## Milestone (Emilio, 2026-09-07)

> In-gym flow **flawless** first, then **program-creation**. Nothing heavy before the flow is flawless.

Phase 1 in-gym flow (now) · Phase 2 program-creation · Phase 3 other users / training together / AI (req-146 stages 2–3).

## Where things stand (2026-10-30)

- **Nothing in flight.** req-253 merged 2026-10-30 (tooling, no deploy). Still `~/projects/workout/` in WORKFLOW/CLOSEOUT/PLANNING (Planner, open).
- **Live = `52637e6`** (through req-252), deployed 2026-10-30 23:06, `doctor: all ok`; CI run 41134719643 green.
  Server `https://macbookpro-intel-2017.tail58ea74.ts.net:8446` (stage 1 done, DEC-127..136, DEC-143).
- **First finished workout synced** [measured, read-only]: 2026-10-28 11:16–11:52, 25 sets (rev 53; 24 workouts). Go-live is
  fully proven.
- **Backups:** weekly agent loaded, exit 0; newest scheduled backup 10-26 09:00; the next is due ≥ 11-02 (7 days). Confirm it fires.
- **Coach run 4 done** 2026-10-30 (report in `workout-data/coach/run-4/`): 2 sessions since run 3 (10-28, 10-30, both on the old
  build), so a session on the new build is still to come.
- **Feedback notes:** server `notes` table, 0 rows (2026-10-30).
- **Working agreement (L-060, DEC-143):** a team, not orders — Planner weighs and pushes back. Merged ≠ live: deploy after any
  served change (CLOSEOUT step 4, L-063). Every req → a throwaway agent; stop at every closeout (DEC-144).

**Deploy:** `./server/deploy` is blocked for Planner by the auto-mode classifier: Emilio runs it (`! ./server/deploy && ./server/doctor`).
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

`PLANNING.md` (planning role + dispatch/review/close/stop) · `BUILDER.md` (the build brief) → `reference/PAGES.md` for page feedback (DEC-137) → `work/BACKLOG.md` → `rules/DESIGN.md`
before UI/UX → `rules/WORKFLOW.md` for process → `rules/CLOSEOUT.md` to close a req → `rules/BACKEND.md` for the server.
`README.md` is the product contract.
