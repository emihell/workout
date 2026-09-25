# Now

Updated 2026-09-25. **Shipped: req-01–09, req-11–23, req-25–31, req-33–108, req-110–111, req-109, req-112–113, req-115, req-114, req-120, req-118, req-116–117, req-119, req-121–130, req-133, req-139, req-138, req-140, req-143, req-145, req-147, req-148, req-151, req-150, req-142, req-141, req-24, req-152, req-153, req-154, req-155, req-156, req-157, req-158, req-159, req-160, req-161, req-162, req-163, req-165, req-164, req-166, req-167, req-168, req-169, req-170, req-171** (req-10 pending; req-32 dropped; req-77 PAUSED). **Gym-flow batch 4 LIVE 2026-09-23:** Emilio's feedback JSON
(F1..F10) → req-103..111, plus req-112 (Finish no longer rewrites the routine, DEC-056). DEC-052..057, L-022/023.
**Test lists closed 2026-09-24** (run by Planner in a browser, not on a device; Emilio accepts feel is caught in use):
batch 4 12/12, Tier 1 10/11 + 1 by unit test, batch-3 feel 3 checked (no-zoom: all inputs ≥17 px) + QA findings (BACKLOG §batch 4).
`log/SHIPPED.md`; reqs `work/req-*.md`; index `work/BACKLOG.md`. ≤50 lines.

## Milestone (Emilio, 2026-09-07)

> In-gym flow **flawless** first, then **program-creation**. Nothing heavy before the flow is flawless.

Phase 1 in-gym flow (now, browser-only) · Phase 2 program-creation · Phase 3 backend/users/exercise-DB/AI/styling (gated on the backend fork).

## Next — READY, held for Emilio's go (batches → throwaway agents, DEC-055)

**Nothing in flight.** **Flow audit 2026-09-23 fully LIVE:** Tier 1 req-114..120, Tier 2 req-121..123, Tier 3 req-124..129.

**READY, held:**
- **All follow-ups done (DEC-087)** — audits 2026-09-24 closed out: bugs, cleanup, the storage split, tooling (see
  SHIPPED 2026-09-24/25). **The table is clean** (the review leftovers are closed; see SHIPPED). Next: new features, starting with the creation design (req-144, design
  lane, live with Emilio), then req-10. Emilio: Export + reimport whenever convenient (safe since req-163).
- **Nothing in flight.** Library follow-ups DONE 2026-09-24: 366 fully written (194 staples), 0 rough visible, own-only
  search, RepDB gone, fresh-eyes scanned. No new library fields until req-144 says.
- **req-171 shipped** (Back returns where you came from). **Beginner-persona run done** 2026-09-25 — findings being
  verified by Planner, then → req-144 prep / bugs. Next: the req-144 design session with Emilio.
- **Order (DEC-091):** req-144 creation design → req-10 + in-gym flow → req-146 server later. Export stays.
- **Waiting (Emilio, DEC-075):** req-146 backend (own server), req-144 creation design, req-149 progression rules.
- **Later (BACKLOG §Exercise library):** req-134 browse + muscle filter (+ libraryId in the feedback note) → 132 → 137 →
  131 → 135 → avatars + own figures.
- `req-10` **first-time-exercise setup flow** — waiting (Emilio 2026-09-24: "core still needs improvement");
  spec predates ~100 reqs, rescan before building. **[ux-feel]**

**Gym-flow batch 2 (req-76..86): all LIVE except `req-77` (PAUSED — affordance; folds in n1 Finish/Abandon).**

## Needs decisions — parked until their phase

- **Backend** (Phase 3): decided — Emilio's own server, other users soon (DEC-073); design in req-146; its rules are
  written first (DEC-085 §7).
- **History recalc from a non-latest workout** (Phase 1) — see BACKLOG. **Program model** (Phase 2).

## Where to read

`PLANNING.md` (planning role + the two-agent build loop) → `work/BACKLOG.md` → `rules/DESIGN.md`
before UI/UX → `rules/WORKFLOW.md` for process → `rules/CLOSEOUT.md` to close a req. `README.md`
is the product contract.
