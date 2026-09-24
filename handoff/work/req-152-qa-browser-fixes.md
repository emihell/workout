# req-152 — four small fixes from Planner's browser run (QA-1..4)

**Status: BUILT AND MERGED, 2026-09-24 — branch `req-152` (`f0d8ea7`…`f0d8ea7`, 1 commit).** (2026-09-24) — Phase 1, small. **Gate: functional**; planning browser-tests and merges (DEC-035). No
persisted-data change. Build **after req-24** (both touch workout views; avoids a conflict). Source: Planner's browser run
of the owed test lists, 2026-09-24 (`work/BACKLOG.md` §batch 4 "QA findings"; method L-033). Emilio: "sounds good" to one
bundled req after req-24.

## The four [measured in the browser, `main` 9f7ebcc]

1. **QA-1 — Back after Finish lands on "Not found."** Save on the Finish screen calls `go('/')` (`finish.jsx:98`), which
   pushes; the `#/workout/<id>/finish` entry stays in history. After save, browser Back → a bare "Not found.", Back again →
   the done workout. **Fix:** leaving a finished/abandoned workout for Today **replaces** the history entry
   (`go('/', { replace: true })`, `route.js:81`), so Back never lands on a dead finish route. Check the auto-complete path
   too (`auto-complete.jsx:56`) and the abandon path (`helpers.jsx:43`).
2. **QA-2 — the rest pill's tap area overlaps Back at 375 px.** Pill `[103,8,272,54]` vs "‹ Exercises" `[24,40,115,84]`
   (12×14 px) in a 375 px-wide viewport. The CSS comment (`ui.css:578-583`) says top-centre "keeps it clear of the top-left
   Exercises link"; req-92 enlarged the pill and it no longer is. A tap on the link's top-right can skip the rest instead
   of going back. **Fix:** no overlap between the pill's box and any top-row control at 320–430 px widths. Planner's call
   (unconfirmed): keep the pill top-centre and its size; move or size so the boxes don't intersect — how is yours.
3. **QA-3 — "Add set" on a done exercise prefills reps but not kg.** Leg Press done at 30/60/70/70 kg → Add set → the new
   set shows kg **blank**, reps 10. `withOneMoreSet` (`workout-log.js:34-44`) appends the last target and the last
   suggested weight, so something downstream (the log seed for an added index) drops the kg. [cause inferred — find it].
   **Rule it must follow:** req-108 — weight carries, reps are per set. So the added set prefills kg the way set N+1 would
   (the last logged/entered weight carries; else the appended suggested weight), reps = its appended target. Never an
   invented weight: with no weight anywhere (bodyweight, no history) it stays blank.
4. **QA-4 — History detail doesn't say skipped.** A fully skipped exercise reads "Leg Extension — WU set · 4 sets" in the
   workout's History detail, while the live overview says "· skipped". **Fix:** an exercise whose sets are all skipped
   reads "· skipped" there (same word as the overview); a partly skipped one keeps its count of logged sets. Planner's
   call (unconfirmed): mirror the overview's wording, nothing new.

## Out of scope

The popups (req-24). The "Update?" screen showing no numbers (belongs to the DEC-056 review step, Phase 2). Apply writing
`[0]` instead of `[]` for a cardio item's weights (invisible today; note it in the report if you pass it).

## Acceptance criteria (written before implementation)

- **QA-1:** a test (or scripted browser run) — finish → save → history.back() never renders "Not found."; same for
  abandon and auto-complete. Failure case: Back from Today after save shows the done workout or Today, not a dead route.
- **QA-2:** a measured run at 320, 375 and 430 px: the pill's rect intersects no top-row control's rect (paste the rects).
- **QA-3:** unit test — done at [30,60,70,70] → Add set → the new set's kg prefill = 70, reps = its target. Failure case: a
  bodyweight exercise with no weight history → kg stays blank (no invented weight).
- **QA-4:** unit/render test — all sets skipped → "· skipped"; 2 of 4 skipped → its logged count, no "skipped".
- `./check` green (paste the line). Test edits called out and justified.
