# req-177 — phone-size polish from Planner's screenshot check

**Status: BUILT — branch `req-177` (`8ed5fdb`, 2 commits), NOT merged.** (2026-09-26) **Lane: ui.** Source: Planner's 390×844 screenshots of main `4008e21` (2026-09-26), asked
by Emilio ("these things you can check?") — Planner decides visual calls it can see (DEC-091 §4–5), listed below so
they're reversible.

## What the screenshots showed [measured, scratchpad `effort.png`, `finish.png`, `home174.png`]
1. **Effort "Couldn't finish" wraps to two lines**; the other three segments are one line.
2. **The Finish list pushes Feel and Save off the first screen.** An early stop on Upper Body: 9 lines, 6 of them
   "not started. 3 sets and the warm-up set will be saved as skipped." Feel starts at y≈1330 of 1688 (2× scale).
3. **"1 sets"** — Finish summary `views/workout/finish.jsx:65` and History `views/history/detail.jsx:54` don't singularize.
4. **Empty home:** "Create your first routine" and "Import" stack with ~4 px between them (req-174), tighter than the app's
   stacked buttons elsewhere.

## Change (Planner's calls)
1. Effort label **"Couldn't finish" → "Max"** (one word, plain; DEC-093's wording superseded here). Stored rpe `5` unchanged.
2. Finish list:
   - An exercise **partly logged** keeps its own line: "Leg curl: 1 of 3 sets. The other 2 will be saved as skipped."
   - Exercises **not started** collapse into **one** line: "Not started, saved as skipped: Rowing, Lat Pulldown, Shoulder
     Press." (names in workout order).
   - Unlogged warm-ups are no longer named in the text (still saved as skipped, as today).
   - Still derived from `finishSkippedByItem` (`src/finish-unfinished.js`) — only the wording/grouping changes.
3. "1 set" / "N sets" in both summaries.
4. Empty home: the gap between the two buttons = the app's standard gap between stacked actions (Builder finds the token
   used elsewhere; no new value).

## Out of scope
What Finish saves; the auto-complete summary; any other screen.

## Acceptance criteria
1. Effort shows "Max" on one line at 390 px; stored rpe of a Max set is `5` on branch and main (test).
2. Finish, early stop on Upper Body (seed `db.json`): **one** "Not started…" line + a line per partly-logged exercise; Feel
   visible without scrolling at 390×844 (browser receipt: Feel's `getBoundingClientRect().top` < 844).
3. **Is the right mechanism answering?** The helper's per-item skipped counts still equal `withSkippedUnloggedSets`'s (the
   req-176 tests stay green, unedited except wording assertions — each called out).
4. **Failure case:** everything logged → no lines; everything untouched → only the one "Not started" line; one exercise
   → no trailing comma/"and" artefacts (tests).
5. "1 set" renders for a one-set workout in both places (test).
6. `./check --smoke` green; Planner's screenshot re-check of all four.

Decisions (Planner, reversible): "Max"; collapsing untouched exercises; dropping the warm-up mention; the gap token.
Trigger files: none expected.
