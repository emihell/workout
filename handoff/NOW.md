# Now

Updated 2026-10-31. **Shipped: everything through req-254** (batch 7 complete; the workflow update req-249..252 merged + deployed; req-253 tooling) except req-32 (dropped), req-77 (PAUSED), req-246 (withdrawn) and
the reqs below — `log/SHIPPED.md`. Reqs `work/req-*.md`; open items `work/BACKLOG.md`. ≤50 lines.

**Next:** the fix batch (DEC-155; Emilio: "that is always the priority, otherwise things go stale or we build opon old
code"). Serial, one throwaway agent per req, stop at each closeout. All specced 2026-10-31 and READY unless noted:
1. **req-256** "12 reps" bug — built `req-256` @ `35b2df0`, gate green (2189), reviewer: No blockers. **Waits on AC2 (server).**
2. **req-255** plan build kg estimate · 3. **req-257** plan closeout/worktrees · 4. **req-258** test-gate floors + CI actions ·
5. **req-259** `plan qa --empty` · 6. **req-260** plan build scans live routines (after 255) · 7. **req-261** Ex N + double
tap + Sets cap · 8. **req-262** swaps/cardio/Back guard (after 261; backup reminder) · 9. **req-263** Back chain
(DEC-155 §6 overrides DEC-092) · 10. **req-264** small UI fixes (after 263) · 11. **req-265** library chunk.
Then the DEC-154 features: cues + notes → supersets → intervals. Build here; merges here; deploys on the server.

**On the server machine (Emilio, 2026-10-31: "everything that needs the server … continue there"):**
- req-256 AC2: from branch `req-256`, `node scripts/req-256-targets.mjs --db <data>/workout.db --user <id> --rev 79` →
  expect `identical: true`; then `./plan closeout req-256` (app change → deploy). Or Emilio: "merge without AC2".
- Deploys for every merged app req: `! ./server/deploy && ./server/doctor`.
- Data dir on this laptop is `~/projects/workout/workout-data` (no DB here); docs still say `~/dev/workout/` (Planner, open).

**Emilio's calls before their req dispatches:** none open (req-263 → READY, DEC-155 §6). All `(unconfirmed)` calls
accepted (DEC-155 §4); blank kg stays 0 until new functionality touches it (§5).

## Milestone (Emilio, 2026-09-07)

> In-gym flow **flawless** first, then **program-creation**. Nothing heavy before the flow is flawless.
Phase 1 in-gym flow (now) · Phase 2 program-creation · Phase 3 other users / training together / AI (req-146 stages 2–3).

## Where things stand (2026-10-31)

- **Live = `52637e6`** (through req-252), deployed 2026-10-30 23:06, `doctor: all ok`. req-253/254 tooling, no deploy.
  Server `https://macbookpro-intel-2017.tail58ea74.ts.net:8446`. Coach run 5 plan applied as rev 79.
- **Backups:** newest scheduled 10-26 09:00; the next is due ≥ 11-02. Confirm it fires (server).
- **Working agreement (L-060, DEC-143, DEC-144):** a team, not orders. Merged ≠ live: deploy after any served change.
  Deploy is Emilio's (`! ./server/deploy && ./server/doctor`; the classifier blocks Planner).
- **Emilio's calls, any time:** loop-length re-anchor; req-239/240/242/243 copy `(unconfirmed)`; timer once per side
  (req-240); "Ex" vs "Exercise" (req-244). Planner's lighter path for copy-only reqs — open.

## Needs decisions — parked until their phase

- req-149 progression rules (Emilio, DEC-075).
- req-184 creation design session 2: the program model (Phase 2).
- req-146 stages 2–3: accounts, sharing, privacy, AI cost (Phase 3).
## Where to read

`PLANNING.md` (planning role + dispatch/review/close/stop) · `BUILDER.md` (the build brief) → `reference/PAGES.md` for page feedback (DEC-137) → `work/BACKLOG.md` → `rules/DESIGN.md`
before UI/UX → `rules/WORKFLOW.md` for process → `rules/CLOSEOUT.md` to close a req → `rules/BACKEND.md` for the server.
`README.md` is the product contract.
