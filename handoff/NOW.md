# Now

Updated 2026-09-24. **Shipped: req-01–09, req-11–23, req-25–31, req-33–108, req-110–111, req-109, req-112–113, req-115, req-114, req-120, req-118, req-116–117, req-119, req-121–130, req-133, req-139, req-138, req-140, req-143, req-145, req-147, req-148** (req-10 pending; req-24
gated; req-32 dropped; req-77 PAUSED). **Gym-flow batch 4 LIVE 2026-09-23:** Emilio's feedback JSON
(F1..F10) → req-103..111, plus req-112 (Finish no longer rewrites the routine, DEC-056). DEC-052..057, L-022/023.
**Owed by Emilio:** the batch-4 on-device test list (`work/BACKLOG.md` §batch 4, 12 items); older: batch-3 feel
(pill overlap, iPhone no-zoom, beat-line wording, Timed discoverability).
`log/SHIPPED.md`; reqs `work/req-*.md`; index `work/BACKLOG.md`. ≤50 lines.

## Milestone (Emilio, 2026-09-07)

> In-gym flow **flawless** first, then **program-creation**. Nothing heavy before the flow is flawless.

Phase 1 in-gym flow (now, browser-only) · Phase 2 program-creation · Phase 3 backend/users/exercise-DB/AI/styling (gated on the backend fork).

## Next — READY, held for Emilio's go (batches → throwaway agents, DEC-055)

**Nothing in flight.** **Flow audit 2026-09-23 fully LIVE:** Tier 1 req-114..120, Tier 2 req-121..123, Tier 3 req-124..129.

**READY, held:**
- **Building:** `req-151` library batch 5, the last (queue 34). **Then:** `req-150` progression safe-hold (READY). **Waiting (Emilio, DEC-075):** req-146 backend (own server), req-144 creation design, req-149
  progression rules — after current follow-ups.
  Library batches continue alongside it on stable fields only; no new fields until req-144 says (2026-09-24). Then
  up to par → `req-142` remove RepDB → `req-141` fresh scan (DEC-070). Then `req-134` browse + muscle
  filter (+ libraryId in the feedback note) → 132 → 137 → 131 → 135 → avatars + own
  figures (BACKLOG §Exercise library). Library LIVE 2026-09-24: 218 fully written (193 staples), names + text + difficulty, own-only search.
  Unconfirmed calls (library req) for Emilio's list: rhomboids→Back, rear delts→Shoulders; `libraryId` kept on rename;
  whole-library aliases → the tagging pass; RepDB pictures joined at runtime.
- `req-10` **first-time-exercise setup flow** — waiting (Emilio 2026-09-24: "core still needs improvement");
  spec predates ~100 reqs, rescan before building. **[ux-feel]**

**Gym-flow batch 2 (req-76..86): all LIVE except `req-77` (PAUSED — affordance; folds in n1 Finish/Abandon).**

## Needs decisions — parked until their phase

- **`req-24` native confirm/alert → inline UI** — 10 sites; needs the inline-confirm *pattern*
  first (bar/sheet vs two-tap vs undo). **[ux-feel]** Spec: `work/req-24-inline-confirm-alert.md`.
- **Backend fork** (gates Phase 3): browser-only vs database/server (+users, AI key). Decide first.
- **History recalc from a non-latest workout** (Phase 1) — see BACKLOG. **Program model** (Phase 2).

## Where to read

`PLANNING.md` (planning role + the two-agent build loop) → `work/BACKLOG.md` → `rules/DESIGN.md`
before UI/UX → `rules/WORKFLOW.md` for process → `rules/CLOSEOUT.md` to close a req. `README.md`
is the product contract.
