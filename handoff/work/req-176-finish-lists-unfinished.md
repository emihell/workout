# req-176 — Finish lists what's unfinished before you save

**Status: BUILT AND MERGED, 2026-09-25 — branch `req-176` (`3e20a66`…`b740037`, 2 commits).** (2026-09-25) **Lane: ui.** Source: persona run (req-144 prep §E.7). Emilio: "i go with yes" to
Planner's recommendation (DEC-093, closing its Open item).

## Today [read 2026-09-25]
The Finish screen shows `{name} — {minutes} min · {setCount} sets` and a "Nothing logged." warning only when nothing
was logged (`views/workout/finish.jsx:37-73`). Saving runs `withSkippedUnloggedSets` (`workout-log.js:159-169`), which
records every planned-but-unlogged set as skipped — silently. Persona: Seated Leg Curl 1 of 3 sets → Finish → Feel, no word.

## Change
Under the summary line, for each exercise that Finish **will** add skipped sets to, one quiet line, e.g.:
- **"Leg curl: 1 of 3 sets. The other 2 will be saved as skipped."**
- untouched: **"Leg press: not started. 3 sets will be saved as skipped."**

No pop-up, no extra tap, Save/Abandon unchanged. Nothing listed when everything planned was logged. Order: the workout's
exercise order. Counts are work sets as the user sees them on the overview; a planned warm-up still unlogged may be
mentioned or folded in — Builder picks, states it (implementation).

**The mechanism:** the list is derived from exactly what Save will write — the diff between `active.sets` and
`withSkippedUnloggedSets(active).sets` per item — not a second counting rule. Put it in a pure, unit-tested helper; prefer a
new file that *calls* `withSkippedUnloggedSets` over editing `workout-log.js` (a DEC-057 trigger file — if it is edited,
the independent reviewer runs before merge).

## Out of scope
Changing what Finish saves; blocking Finish; the auto-complete summary (`auto-complete.jsx`) — it only appears when all
items are done.

## Acceptance criteria
1. Half-done, untouched and fully-done exercises → the right lines (and none for the done one) — unit tests on the helper.
2. **Is the right mechanism answering?** For each test workout, the helper's per-item skipped counts equal the number of
   skipped sets `withSkippedUnloggedSets` actually adds for that item (assert against it, not a hand count).
3. **Failure case — empty/absent input:** a workout with no snapshot items, and a legacy active workout (DEC-088 shape,
   items without `id`), render Finish without error and list nothing wrong (tests).
4. Browser (Planner, `plan qa`): log 1 of 3 sets on one exercise, none on another → Finish shows both lines → Save → the
   stored workout's skipped sets match the lines (read back `workout-mvp-v9`).
5. `./check --smoke` green.

Decisions: the two sentence shapes are Planner's recommendation Emilio accepted. Siblings: req-175 renames labels —
independent; build after req-172..175 or in parallel (no shared file: `finish.jsx` is not in 172–175).
