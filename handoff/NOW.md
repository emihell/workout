# Now

Updated 2026-09-17. **Shipped: req-01–09, req-11–23, req-25–31, req-33–91** (req-10 pending; req-24
gated; req-32 dropped; req-77 PAUSED). **Gym-flow batch 3 (from Emilio's in-app feedback JSON,
2026-09-16) SPEC'D & handed to Builder: req-92 (rest pill bigger), req-93 (main implied+bold, only
WU/finisher labelled), req-94 (Today one stateful list), req-95 (feedback textarea iOS-zoom fix).**
Parked to detail: **req-96** (remove finish "Next time" → light "beat last time" line; total-volume,
quiet). Note n1 (Finish/Abandon side-by-side) folds into PAUSED **req-77**. Owed by Emilio: **one live
`./plan preview` run** (tailscaled up); the timed-exercise browser flow (req-85); the req-78/req-25
Previous-then-forward check.
Loose follow-ups (deferred): req-85 v1 gaps (timed-set duration not editable; timed bodyweight still
asks effort). Done: `log/SHIPPED.md`. Full reqs: `work/req-*.md`; index: `work/BACKLOG.md`. ≤50 lines.

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

**Still decision-gated:** req-24 inline-confirm pattern; history-recalc behaviour; req-82/83/84/85/86 (above).

## Needs decisions — parked until their phase

- **`req-24` native confirm/alert → inline UI** — 10 sites; needs the inline-confirm *pattern*
  first (bar/sheet vs two-tap vs undo). **[ux-feel]** Spec: `work/req-24-inline-confirm-alert.md`.
- **Backend fork** (gates Phase 3): browser-only vs database/server (+users, AI key). Decide first.
- **History recalc from a non-latest workout** (Phase 1) — see BACKLOG. **Program model** (Phase 2).

## Where to read

`PLANNING.md` (planning role + the two-agent build loop) → `work/BACKLOG.md` → `rules/DESIGN.md`
before UI/UX → `rules/WORKFLOW.md` for process → `rules/CLOSEOUT.md` to close a req. `README.md`
is the product contract.
