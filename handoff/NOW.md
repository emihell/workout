# Now

Updated 2026-09-18. **Shipped: req-01–09, req-11–23, req-25–31, req-33–105** (req-10 pending; req-24
gated; req-32 dropped; req-77 PAUSED). **Gym-flow batch 3 (Emilio's in-app feedback JSON, 2026-09-16) all
LIVE:** req-92 rest pill bigger · req-93 main bold/unlabelled + WU/finisher tag · req-94 Today one list,
no header (DEC-049) · req-95 feedback textarea iOS-zoom · **req-96** "Next time"→"↑ you beat last time"
(per-exercise any axis, name the win; `beat-last-time.js` — DEC-050). **req-96 aftermath (Emilio
"fix now" 2026-09-17):** **req-97 + req-98 LIVE** — req-97 deleted dead `formatProgressionLine`; req-98
guarded the timed beat-last-time comparison (editable-actual capture already existed in req-85, so only a
false-win guard was needed). **req-99 LIVE** — Timed flag now reachable from the routine editor via
an "Edit exercise settings →" link + hint (return-to-routine via `?from=` route param, DEC-051).
**Nothing building.**
Owed by Emilio: on-device feel of batch 3 + req-96 + req-99 (pill overlap, real-iPhone no-zoom,
beat-line wording, does a first-timer now find Timed); to use timed "↑ Longer", flag exercises
(plank/rowing) via the editor's Timed checkbox; live `./plan preview`.
`log/SHIPPED.md`; reqs `work/req-*.md`; index `work/BACKLOG.md`. ≤50 lines.

## Milestone (Emilio, 2026-09-07)

> In-gym flow **flawless** first, then **program-creation**. Nothing heavy before the flow is flawless.

Phase 1 in-gym flow (now, browser-only) · Phase 2 program-creation · Phase 3 backend/users/exercise-DB/AI/styling (gated on the backend fork).

## Next — READY, held for Emilio's go (built via DEC-037 ephemeral-agent batches)

**Nothing in flight.** req-100..102 LIVE (tooling: `plan ping`, NOW.md guard, drift check — L-019..021).

**READY, held:**
- `req-106`..`req-111` **gym-flow batch 4** (103–105 LIVE) (feedback 2026-09-17..20; reviewed 2026-09-23; `BACKLOG.md` §batch 4):
  106 set preview · 107 overview
  note · 108 reps stop carrying (DEC-052) · 110 Today 2-routine day · 111 skip-proof "last time" (DEC-053) ·
  109 skip/replace (model.js — reviewer). Build order 106,107,108,110,111,109.
- `req-10` **first-time-exercise setup flow** — auto-prompt on a no-history exercise; never invents
  the first weight (DEC-012). Larger; needs flow design first. **[ux-feel]**

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
