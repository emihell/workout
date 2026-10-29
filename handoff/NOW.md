# Now

Updated 2026-10-26. **Shipped: everything through req-248, req-240** except req-32 (dropped), req-77 (PAUSED) and the reqs below —
`log/SHIPPED.md`. Reqs `work/req-*.md`; open items `work/BACKLOG.md` (rewritten 2026-10-26 to open items only). ≤50 lines.

## Milestone (Emilio, 2026-09-07)

> In-gym flow **flawless** first, then **program-creation**. Nothing heavy before the flow is flawless.

Phase 1 in-gym flow (now) · Phase 2 program-creation · Phase 3 other users / training together / AI (req-146 stages 2–3).

## Where things stand

- **Server LIVE** at `https://macbookpro-intel-2017.tail58ea74.ts.net:8446` (stage 1, DEC-127..136). Deployed `7e6d7b9`, doctor
  all ok. Planner may run `./server/deploy`, `start`, `stop`. Off-Mac backup: Emilio's own ("ill worry about ecternal backup").
- **Left for go-live (Emilio):** on the phone, clear `:8446` site data → log in → log a workout. That closes go-live ACs 4–5.
- **Watch:** the nightly backup didn't fire 10-26 01:00 (cause unknown). Weekly backup + hourly catch-up + doctor check
  added (DEC-136). Confirm a scheduled run fired.
- **Coach (DEC-140/141):** brief `coach/COACH.md`; runs in `~/dev/workout/workout-data/coach/run-N/`; plans into the DB via
  `./server/ops plan`. Run 3 written as rev 5 (2026-10-26, backup `…122551-before-plan-coach.db`). Iterate as Emilio logs.
- **Feedback notes:** server table `notes` (read-only). 0 rows on 2026-10-26.
- **Cleanup 2026-10-26** (Emilio: "we dont want anything old and we want to update what we have before we start soemthing
  new"): docs now describe the live server, and BACKLOG holds only open items. Held reqs are current [measured: since their
  specs, `git diff --stat c3596e8 main -- src` touches only `src/req-200.test.js`]. Left: README (code-side) still says "browser-only MVP" → a tiny req.

**Stage 1 fallout — finish before anything else (DEC-143):**
- Phone go-live: **done** 2026-10-26 16:26Z [measured, read-only]: the phone pulled the coach's rev 5, then pushed revs 6–12
  (a test workout to 9 sets, then abandoned; rev 12 byte-identical to rev 5). Login was proven by the 10-25 session.
- Pages leftovers: req-238 + req-247 shipped. **Stage-1 fallout list is empty → batch 7 unblocked (DEC-143).**
- Ops: `./server/doctor` after every server deploy is CLOSEOUT step 4 (req-246 withdrawn, wrong premise).

**READY, held:**
- Batch 7: req-241 → req-242, req-243; req-244 (GO pill, look A). **req-241 building** (Builder). Live = `d1f52ad`.
  Batch 7, DEC-138/139, unblocked by DEC-143 (its first req shipped 2026-10-26).

## Needs decisions — parked until their phase

- req-149 progression rules (Emilio, DEC-075).
- req-184 creation design session 2: the program model (Phase 2).
- req-146 stages 2–3: accounts, sharing, privacy, AI cost (Phase 3).

## Where to read

`PLANNING.md` (planning role + the two-agent build loop) → `reference/PAGES.md` for page feedback (DEC-137) → `work/BACKLOG.md` → `rules/DESIGN.md`
before UI/UX → `rules/WORKFLOW.md` for process → `rules/CLOSEOUT.md` to close a req → `rules/BACKEND.md` for the server.
`README.md` is the product contract.
