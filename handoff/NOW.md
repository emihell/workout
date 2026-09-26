# Now

Updated 2026-09-26. **Shipped: req-01–09, req-11–23, req-25–31, req-33–108, req-110–111, req-109, req-112–113, req-115, req-114, req-120, req-118, req-116–117, req-119, req-121–130, req-133, req-139, req-138, req-140, req-143, req-145, req-147, req-148, req-151, req-150, req-142, req-141, req-24, req-152, req-153, req-154, req-155, req-156, req-157, req-158, req-159, req-160, req-161, req-162, req-163, req-165, req-164, req-166, req-167, req-168, req-169, req-170, req-171–177, req-179–181, req-178, req-182** (req-10 pending; req-32 dropped; req-77 PAUSED). **Gym-flow batch 4 LIVE 2026-09-23:** Emilio's feedback JSON
(F1..F10) → req-103..111, plus req-112 (Finish no longer rewrites the routine, DEC-056). DEC-052..057, L-022/023.
`log/SHIPPED.md`; reqs `work/req-*.md`; index `work/BACKLOG.md`. ≤50 lines.

## Milestone (Emilio, 2026-09-07)

> In-gym flow **flawless** first, then **program-creation**. Nothing heavy before the flow is flawless.

Phase 1 in-gym flow (now, browser-only) · Phase 2 program-creation · Phase 3 backend/users/exercise-DB/AI/styling (gated on the backend fork).

## Next — READY, held for Emilio's go (batches → throwaway agents, DEC-055)

**Batch 2026-09-26 (req-144 → req-178..181) shipped** — Emilio: "start building and merge, one by one … close out yourself".
Sam run done (req-144 prep §G). req-182 shipped. **Next: Emilio's end-of-batch list** (below).
**Flow audit 2026-09-23 fully LIVE:** Tier 1 req-114..120, Tier 2 req-121..123, Tier 3 req-124..129.

**READY, held:**
- **Done:** DEC-087 follow-ups, library (366 written, 194 staples), DEC-092..095 fixes; req-144 session 1 → DEC-096..101.
- **Order (DEC-091):** req-144 (advanced/program questions next session) → req-10 + in-gym flow → req-146 server later.
- **Waiting (Emilio, DEC-075):** req-146 backend, req-149 progression rules. `req-10` first-time setup — rescan first. **[ux-feel]**
- **Later (BACKLOG §Exercise library):** req-134 browse + muscle filter → 132 → 137 → 131 → 135 → avatars.

**Gym-flow batch 2 (req-76..86): all LIVE except `req-77` (PAUSED — affordance; folds in n1 Finish/Abandon).**

## Emilio's list — batch 2026-09-26 (req-178..182)

**Three decisions (Sam run, prep §G):** (1) you skip the "Save to routine" offer and the routine had no kg → next time the kg
is blank with no trace of what you lifted: show "last time" only in that case? (DEC-096 §5 dropped it) (2) blank kg accepted on
Complete — block it, or keep the note? (3) no check on typos (500 kg saved) — warn on a jump over, say, 50%?
**Planner's calls to glance at** (all reversible, details in each req): 3×10/90 s starting plan wording; slot names and
weekdays (Mon / Mon-Thu / Mon-Wed-Fri / Mon-Tue-Thu-Fri); dips → chest; auto-finish waits when an offer is open; picks carry
to later days; routine kg fill once per device, an imported old backup keeps its kg (fix a backup first with
`node scripts/fill-routine-kg.mjs <file> --out <copy>`). **Feel on a phone:** per-set fields, pinned Save bars.

## Needs decisions — parked until their phase

- **Backend** (Phase 3): decided — Emilio's own server, other users soon (DEC-073); design in req-146; its rules are
  written first (DEC-085 §7).
- **History recalc from a non-latest workout** (Phase 1) — see BACKLOG. **Program model** (Phase 2).

## Where to read

`PLANNING.md` (planning role + the two-agent build loop) → `work/BACKLOG.md` → `rules/DESIGN.md`
before UI/UX → `rules/WORKFLOW.md` for process → `rules/CLOSEOUT.md` to close a req. `README.md`
is the product contract.
