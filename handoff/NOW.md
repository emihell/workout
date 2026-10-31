# Now

Updated 2026-10-31. **Shipped: everything through req-254, req-257–258, req-266, req-259, req-261, req-268, req-262** (batch 7 complete; the workflow update req-249..252 merged + deployed; req-253 tooling) except req-32 (dropped), req-77 (PAUSED), req-246 (withdrawn) and
the reqs below — `log/SHIPPED.md`. Reqs `work/req-*.md`; open items `work/BACKLOG.md`. ≤50 lines.

**Next:** the fix + structure batch (DEC-155 §1, §7: fixes, workflow, structure, cleanups before any feature). Serial, one
throwaway agent per req, stop at each closeout. Done 10-31: req-257, 258, 266, 259. Order:
1. ~~req-261~~ merged 10-31 (deploy on server) → 2. ~~req-268~~ merged 10-31 →
3. ~~req-262~~ merged 10-31 → 4. ~~req-269~~ merged 10-31 → 5. **req-270** split
`workout-log.js` → 6. **req-271** DECISIONS split + digest → **req-272** grants/hook text/size ratchet → 7. **req-263** Back chain → 8. **req-264**
small UI fixes → 9. **req-265** library chunk. Server-held: **req-256** (built `35b2df0`, reviewed; AC2) → **req-255** → **req-260**.
Then the DEC-154 features: cues + notes → supersets → intervals. Build here; merges here; deploys on the server.

**On the server machine (Emilio, 2026-10-31: "everything that needs the server … continue there"):**
- req-256 AC2: from branch `req-256`, `node scripts/req-256-targets.mjs --db <data>/workout.db --user <id> --rev 79` →
  expect `identical: true`; then `./plan closeout req-256` (app change → deploy). Or Emilio: "merge without AC2".
- Deploy (merged, not live: **req-261, 268, 262**; export a backup on the phone first, DEC-046) : `! ./server/deploy && ./server/doctor`, then `./server/ops duplicates`; live `52637e6`.
- Data dir: server `~/dev/workout/workout-data` (`server/config.mjs:14`, docs right); this laptop keeps `~/projects/workout/workout-data`, no DB.

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
  Deploy is Emilio's (`! ./server/deploy && ./server/doctor`; the classifier blocks Planner). One planner session at a time (Emilio: "i will never
  run two planner instances sumiltainiusly"): server work waits for a clean point here.
- **Emilio's calls, any time:** loop-length re-anchor; req-239/240/242/243 copy `(unconfirmed)`; timer once per side
  (req-240); "Ex" vs "Exercise" (req-244). Planner's lighter path for copy-only reqs — open.

## Needs decisions — parked until their phase

- req-267 Researcher MVP (design; "not now … an mvp of it soon"): 5 questions. After the fix batch.
- req-149 progression rules (Emilio, DEC-075).
- req-184 creation design session 2: the program model (Phase 2).
- req-146 stages 2–3: accounts, sharing, privacy, AI cost (Phase 3).
## Where to read

`PLANNING.md` (planning role + dispatch/review/close/stop) · `BUILDER.md` (the build brief) → `reference/PAGES.md` for page feedback (DEC-137) → `work/BACKLOG.md` → `rules/DESIGN.md`
before UI/UX → `rules/WORKFLOW.md` for process → `rules/CLOSEOUT.md` to close a req → `rules/BACKEND.md` for the server.
`README.md` is the product contract.
