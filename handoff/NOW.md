# Now

Updated 2026-10-26. **Shipped: req-01–09, req-11–23, req-25–31, req-33–108, req-110–111, req-109, req-112–113, req-115, req-114, req-120, req-118, req-116–117, req-119, req-121–130, req-133, req-139, req-138, req-140, req-143, req-145, req-147, req-148, req-151, req-150, req-142, req-141, req-24, req-152, req-153, req-154, req-155, req-156, req-157, req-158, req-159, req-160, req-161, req-162, req-163, req-165, req-164, req-166, req-167, req-168, req-169, req-170, req-171–177, req-179–181, req-178, req-182–183, req-185–195, req-197–211, req-212–219, req-10, req-220, req-221, req-222, req-223, req-224, req-225, req-226, req-227–228, req-232, req-229, req-230, req-231, req-233–235** (req-32 dropped; req-77 PAUSED). **Gym-flow batch 4 LIVE 2026-09-23:** Emilio's feedback JSON
(F1..F10) → req-103..111, plus req-112 (Finish no longer rewrites the routine, DEC-056). DEC-052..057, L-022/023.
`log/SHIPPED.md`; reqs `work/req-*.md`; index `work/BACKLOG.md`. ≤50 lines.

## Milestone (Emilio, 2026-09-07)

> In-gym flow **flawless** first, then **program-creation**. Nothing heavy before the flow is flawless.

Phase 1 in-gym flow (now, browser-only) · Phase 2 program-creation · Phase 3 backend/users/exercise-DB/AI/styling (gated on the backend fork).

## Next — READY, held for Emilio's go (batches → throwaway agents, DEC-055)

**Batch 2026-09-26 (req-144 → req-178..181) shipped** — Emilio: "start building and merge, one by one … close out yourself".
Sam run done (req-144 prep §G). req-182 shipped. **Next: Emilio's end-of-batch list** (below).

**READY, held:**
- **NOW (2026-10-25): server LIVE** at `https://macbookpro-intel-2017.tail58ea74.ts.net:8446` (ops reqs shipped, see SHIPPED;
  Emilio's data in as rev 1 via `putState`, 50/8/23/571, 48 linked; `passwd` set by Emilio; Planner may run `./server/deploy`,
  `start`, `stop` — allow rules added 2026-10-25). **Left:** (1) Emilio: phone — clear `:8446` site data → login → log a
  workout; then the go-live ACs 4–5 are done. (2) **Nightly did NOT fire 10-26 01:00** (Mac awake, cause unknown;
  kickstart → exit 0); doctor missed it → req-237. Backups go weekly (DEC-136). (3) Off-Mac backup copy: Emilio handles it himself ("ill worry about ecternal backup", 2026-10-26) — not tracked. (4) Pages shut down, site 404 (DEC-135). Images: backlog.
- **READY 2026-10-26, unbuilt:** req-236 (req-200 test red on Mondays — till then `plan publish` needs `WORKOUT_SKIP_CHECK=1`
  on Mondays) → req-238 (CI check-only, re-enable); req-237 (weekly backup + hourly catch-up + doctor), independent.
- **Batch 7 (BACKLOG §batch 7):** READY 239 → 240 → 241, 242, 243; req-244 GO pill NEEDS DECISIONS (A/B/C). Held for go.
- **Cleanup batch 2026-10-14 + batch 6 (DEC-125/126) DONE.** Feel list: SHIPPED; follow-ups BACKLOG §batch 6.
- **Batch 2026-10-07 — app organisation (DEC-110..112): DONE, 198–211 shipped. Open: CSV export (later), progress (later), req-184 session 2**, throwaway agents, Planner closes. Then req-184
  session 2. Batch 192–195 feel list: each req's "Built — calls".
- **Waiting (Emilio, DEC-075):** req-149 progression rules.
- **Later (BACKLOG §Exercise library):** req-134 browse + muscle filter → 132 → 137 → 131 → 135 → avatars.

## Emilio's list — batch 2026-09-26 (req-178..182)

**Decisions → DEC-102** (Emilio: "ill go with your recommandations"); req-183 kg hints shipped. Feel: Emilio in workouts.
**Planner's calls to glance at** (all reversible, details in each req): 3×10/90 s starting plan wording; slot names and
weekdays (Mon / Mon-Thu / Mon-Wed-Fri / Mon-Tue-Thu-Fri); dips → chest; auto-finish waits when an offer is open; picks carry
to later days; routine kg fill once per device, an imported old backup keeps its kg (fix a backup first with
`node scripts/fill-routine-kg.mjs <file> --out <copy>`). **Feel on a phone:** per-set fields, pinned Save bars.

## Needs decisions — parked until their phase

- **Backend** (Phase 3): decided — Emilio's own server, other users soon (DEC-073); design in req-146; its rules are
  written first (DEC-085 §7).
- **History recalc from a non-latest workout** (Phase 1) — see BACKLOG. **Program model** (Phase 2).

## Where to read

`PLANNING.md` (planning role + the two-agent build loop) → `reference/PAGES.md` for page feedback (DEC-137) → `work/BACKLOG.md` → `rules/DESIGN.md`
before UI/UX → `rules/WORKFLOW.md` for process → `rules/CLOSEOUT.md` to close a req. `README.md` is the product contract.
