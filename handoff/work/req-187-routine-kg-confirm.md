# req-187 — new weight → a confirm on the exercise's last Complete, not a row in the list

**Status: READY** (2026-10-05). **Lane: ui.** From DEC-103 §1 (req-184 feedback F4, F11–F13). Siblings: after **req-186**,
before **req-188** (all edit `views/workout/item.jsx`). Writes the routine only through the existing
`store.applyRoutineUpdate` (no new write path, no schema change); touches `store.jsx` only if a sheet hook is needed →
reviewer if it does.

## What Emilio said (2026-10-05)
- F4 "What is save to sesh?" (the inline button reads "Save to {routine name}"; his routine was named "sesh")
- F11 "Why didn't biceps curl save as usual? Why do I have to save it?"
- F12 "seems to becouse I edited the exercise? Should be a pop up or something when completing the exercise"
- F13 "it says saved to upper body, should be a pop/confirmation when pressing complete, not information in this list"
- Chose: "Sheet on last Complete" (2026-10-05).

## Code today (main `cbd9a78`)
- Offer logic (pure, keep): `routineUpdateOffer` `routine-update-offer.js:23-42` — null for a mid-workout replacement, an
  unweighted exercise, a gone/archived routine or item, all-skipped, or kg already equal; `offerText` `:51-55`.
- Rendered inline: `RoutineUpdateOffer` (`views/workout/routine-offer.jsx`) under each completed overview row
  (`overview.jsx:171`) and under "Update your routine?" in the auto-complete summary (`auto-complete.jsx:102-115`), which
  also holds the countdown while an offer is open (req-182).
- Last Complete navigates at once: `completeSet` → `if (done) markDoneAndGoToOverview(...)` (`item.jsx:251`,
  `:180-183`).
- The one bottom sheet: `askConfirm(message, { confirmLabel })` (`ui/confirm.js:17`), `ConfirmSheet` in `ui/index.jsx`
  (~`:250-290`): Cancel label fixed, Cancel focused, and **any `hashchange` answers false** (`ui/index.jsx:262`) — so a
  sheet opened before the navigation to the overview is dismissed by it. Order the two accordingly.

## Scope (ordered)
1. On the Complete that finishes an exercise (its last planned set), compute `routineUpdateOffer` **with that set
   included**. Offer null → today's flow, no sheet.
2. Offer present → a bottom sheet: title "Update {exercise}?", body e.g. "You lifted 25 kg · Upper body says 20 kg"
   (`offerText` wording, routine named), buttons **[Keep 20 kg]** (left, secondary) and **[Update routine]** (right,
   primary). Update → `store.applyRoutineUpdate(offer)`; Keep → nothing written. Either → the overview, as today. Backdrop
   / Escape = Keep. The sheet must survive (or come after) the navigation to the overview.
3. Remove the inline offer row from the overview list and the "Update your routine?" section from the auto-complete
   summary; the auto-complete countdown runs as before req-182 (no offer to wait on).
4. The rest timer arms on that Complete exactly as today, sheet or not.

## Out of scope
- Offer logic changes (`routineUpdateOffer` stays as is). Auto-saving (rejected, DEC-103 §1 / DEC-056).
- An offer after editing a set later on the done page, on Finish, or in History — none get a sheet `(unconfirmed)`.
- Pill / set list (req-186); Swap/Skip/Add (req-188).

## Acceptance
1. Browser: routine kg 20, log 25 on every set, last Complete → sheet shows 25 vs 20 and names the routine; Update →
   localStorage routine item `suggestedWeights` = [25,25,25] (receipt) and the overview has no offer row.
2. Same, Keep → routine item unchanged (receipt), overview shown, no offer row.
3. **Failure case:** kg equal to the routine → no sheet. Mid-workout replacement, bodyweight exercise, all sets skipped →
   no sheet (unit test over the call site's decision, plus one browser run).
4. **Failure case:** routine deleted/archived mid-workout → no sheet, Complete still finishes the exercise.
5. Last exercise of the workout with a differing kg → sheet first, then the auto-complete summary with its countdown and
   no "Update your routine?" section.
6. Rest pill/timer after the sheet: armed as for any last set (`restEndsAt` set — receipt).
7. `./check` green.

## Decisions made on Emilio's behalf
- behaviour `(unconfirmed)`: wording ("Update {exercise}?", "Keep 20 kg" / "Update routine"); backdrop = Keep; no sheet
  for later set edits / Finish / History; auto-complete loses its offer section.
- implementation: reuse/extend `ConfirmSheet` (cancel label, non-destructive styling) vs a new sheet — Builder's choice.
