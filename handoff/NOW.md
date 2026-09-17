# Now

Updated 2026-09-17. **Shipped: req-01–09, req-11–23, req-25–31, req-33–96** (req-10 pending; req-24
gated; req-32 dropped; req-77 PAUSED). **Gym-flow batch 3 (Emilio's in-app feedback JSON, 2026-09-16) all
LIVE:** req-92 rest pill bigger · req-93 main bold/unlabelled + WU/finisher tag · req-94 Today one list,
no header (DEC-049) · req-95 feedback textarea iOS-zoom · **req-96** "Next time"→"↑ you beat last time"
(per-exercise any axis, name the win; `beat-last-time.js` — DEC-050). **req-96 aftermath (Emilio
"fix now" 2026-09-17):** **req-97 READY→Builder** (delete only the truly-dead `formatProgressionLine`;
rest of progression is LIVE, corrected). **req-98 NEEDS DECISION** — timed exercises log no ACTUAL
duration (req-85 unused: 0 exercises `hasDuration`, timed logged as constant free-text target), so
beat-last-time can't compare timed; pivotal Q = how to capture the actual (A editable/B countdown/C
stopwatch). Note n1 (Finish/Abandon) folds into PAUSED **req-77**. Owed by Emilio: on-device feel of
batch 3 + req-96 (pill overlap, real-iPhone no-zoom, beat-line wording); live `./plan preview`.
`log/SHIPPED.md`; reqs `work/req-*.md`; index `work/BACKLOG.md`. ≤50 lines.

## Milestone (Emilio, 2026-09-07)

> In-gym flow **flawless** first, then **program-creation**. Nothing heavy before the flow is flawless.

Phase 1 in-gym flow (now, browser-only) · Phase 2 program-creation · Phase 3 backend/users/exercise-DB/AI/styling (gated on the backend fork).

## Next — READY, held for Emilio's go (built via DEC-037 ephemeral-agent batches)

**IN FLIGHT — gym-flow batch 3, handed to Builder 2026-09-17 (all READY, ux-feel except n7=bug):**
- `req-92` rest pill bigger (±30s stays dropped — DEC-048) · `req-93` main implied+bold, only
  WU/finisher labelled · `req-94` Today one stateful list (kill double-divider) · `req-95` feedback
  textarea font ≥16px so iOS stops zooming. Source: Emilio's in-app feedback notes JSON.
- `req-96` **NEEDS DECISION** — remove finish "Next time" (inert without RPE) → light "beat last
  time" line (total volume vs prev same-routine, quiet). Detail metric with Emilio before build.

**READY, held:**
- `req-10` **first-time-exercise setup flow** — auto-prompt on a no-history exercise; never invents
  the first weight (DEC-012). Larger; needs flow design first. **[ux-feel]**

**Gym-flow batch 2 (Emilio 2026-09-14) — req-76..86** (raw: BACKLOG N1–N11). In flight this session
(order at top); req-78 decided 2026-09-16 (remove rest view, self-paced, build last). PAUSED: req-77
affordance. NEEDS DECISION: req-82 empty-day Start, req-83 mid-workout value→default (brushes core
rule), req-84 auto-complete, req-85 timed (model shape), req-86 dev note-capture.

## Needs decisions — parked until their phase

- **`req-24` native confirm/alert → inline UI** — 10 sites; needs the inline-confirm *pattern*
  first (bar/sheet vs two-tap vs undo). **[ux-feel]** Spec: `work/req-24-inline-confirm-alert.md`.
- **Backend fork** (gates Phase 3): browser-only vs database/server (+users, AI key). Decide first.
- **History recalc from a non-latest workout** (Phase 1) — see BACKLOG. **Program model** (Phase 2).

## Where to read

`PLANNING.md` (planning role + the two-agent build loop) → `work/BACKLOG.md` → `rules/DESIGN.md`
before UI/UX → `rules/WORKFLOW.md` for process → `rules/CLOSEOUT.md` to close a req. `README.md`
is the product contract.
