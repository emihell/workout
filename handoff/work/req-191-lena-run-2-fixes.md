# req-191 — Lena run 2 fixes: search by body part, no instant finish on a skip, tap a done set, plain days, reps carry

**Status: READY** (2026-10-06). **Lane: ui.** From req-184 §Persona run 2 and DEC-107 (Emilio, 2026-10-06). Trigger files:
`workout-log.js` (seed / carry, auto-complete) → **independent reviewer** before merge; no stored-record write → no backup
reminder. No schema change, no new persisted field (if one seems needed, stop and report).

## Code today (main `7f95d1f`, read this session)
- Search ranking: `searchCommonFirst` / `rankedHits` (`exerciseCatalog.js:65-136`) score name / alias / muscles / equipment
  per item; a muscle-group word ("back") matches Kickbacks, Back Squat… by name before a seated row. Groups exist:
  `MUSCLE_GROUPS` (`exerciseLibrary.js:55-70`, primaryMuscles → coarse group).
- Auto-complete arms as soon as everything is done: `autoCompleteArmed` (`workout-log.js:377-379`) — incl. when the last
  exercise was just **skipped** via ⋯ → Skip (Lena's mis-tap opened "Finishing in 9s…").
- Set list rows (req-186, `views/workout/item.jsx` `ui-setpreview`): not tappable; Previous opens the logged-set view
  (view state, `viewIndex`).
- Days step label: `dayLabel` (`views/Plan.jsx:274`) → "Today, Fri".
- Kg carry only: `nextSeedOverrides` (`workout-log.js:545-553`) stores `{ weight }`; DEC-052 "reps never carry".
- Add exercise no-history step: `noHistoryItem` defaults `sets = '', rest = ''` (`mid-workout-pick.js:15`).
- Auto-complete stat "Lifted 2,510 kg" (req-189); ExercisePicker primary button "Add N" incl. "Add 0"; search `Field`
  has no clear control.

## Scope (ordered)
1. **Body-part search:** a query that is a muscle-group word or its plain synonym (back, chest, legs, shoulders, arms, core
   / abs — check `MUSCLE_GROUPS` for the real group names and map plain words to them) lists **that group's staples first**
   (machines before free weights `(unconfirmed)`), then today's name hits. Every picker that uses `searchCommonFirst`.
2. **No instant auto-finish after a skip:** when the workout became all-done by a **Skip exercise** (the last change was a
   skip), the summary shows **without the countdown**: [Finish] primary, [Keep going]. A completed last set keeps today's
   countdown. Derive "last change was a skip" from the data (the last set records are skipped) — no new field.
3. **Tap a done set row** in the set list → the same logged-set view Previous opens (Next / Save, rest untouched). Upcoming
   rows stay inert.
4. **Plain days:** the days step reads e.g. "Starts today (Tue), then every Tue and Fri" `(unconfirmed)` instead of
   "Today, Fri".
5. **DEC-107 §1:** Add exercise's no-history step opens with Sets **3** and Rest **90** filled (editable). Swap unchanged
   (DEC-106 copies).
6. **DEC-107 §2:** on a set with **no reps target**, the next set's reps start with what was logged on the previous set of
   that exercise this session (carry like kg). With a target, the target prefills (unchanged). Warm-up unaffected.
7. **Small:** machines-first routine names "My workout" / "My workout A/B" `(unconfirmed)`; summary stat "Total lifted
   (all sets added up)" `(unconfirmed)`; the picker's button reads "Add" (disabled) at 0, "Add N" otherwise; a clear (×)
   button in picker search fields.

## Out of scope
Home order (req-60, Emilio's). Rest editing mid-exercise (BACKLOG). Exercise descriptions / "what the machine does" search.

## Acceptance
1. Unit: "back" → the first rows are back-group staples (name them from the library in the test); "kickback" still finds
   Kickbacks first.
2. Unit + browser: ⋯ → Skip on the last not-done exercise → summary with no "Finishing in" text and no auto-finish after
   12 s (receipt: `activeWorkout` still present); completing the last set normally → countdown as before.
3. Browser: tap a done set row → "Set 1 · logged" view; `sets.length` and `restEndsAt` unchanged (receipts).
4. Browser: days step at 2 days on a Tuesday reads "Starts today (Tue), then every Tue and Fri".
5. Unit + browser: Add a never-done exercise → step shows 3 and 90; accepting stores sets 3, restSec 90, kg [] (receipt).
6. Unit: no-target exercise, set 1 logged 10 reps → set 2 seed reps "10"; with a target "8" → set 2 seed "8" regardless.
   **Failure case:** set 1 skipped → set 2 reps stay blank (a skip carries nothing).
7. **Failure case:** "Add" disabled with nothing ticked; × clears the query and the list returns to the empty-search view.
8. `./check` green; smoke green; the reviewer's verdict quoted.

## Decisions made on Emilio's behalf `(unconfirmed)`
Group-word list and machines-first order; the no-countdown summary after a skip; days wording; "My workout" names; "Total
lifted (all sets added up)"; clear (×).
