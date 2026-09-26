# req-182 — the update-routine offer says what it's about; the plan's fill screen shows what you picked

**Status: BUILT AND MERGED, 2026-09-26 — branch `req-182` (`b623c58`…`b623c58`, 1 commit).** (2026-09-26). **Lane: ui.** Source: Sam run on main `6c4dc7c` (2026-09-26, after req-178..181), findings 1
and 6 (req-144 prep §G). Planner's calls under DEC-095, marked `(unconfirmed)`, go on Emilio's end-of-batch list. Builds on
req-178 (offer) and req-181 (plan).

## Today [read 2026-09-26, main `6c4dc7c`]
- **Offer row** `views/workout/routine-offer.jsx:10-18`: meta line `You did {kgListText(offer.to)} kg. Routine:
  {kgListText(offer.from) || '—'}.` and a Button `Update {offer.routineName}`. No exercise name; a blank routine reads
  "Routine: —."; after the tap the row just disappears (the offer becomes null), no confirmation.
- **Auto-finish summary** `views/workout/auto-complete.jsx:97-110`: "Update your routine?" lists one `RoutineUpdateOffer`
  per item, under a running countdown (`deadline`, `:60-72`) that commits at 0. Sam: two identical rows ("You did 30/35/35
  kg. Routine: —." / "Update Full body A") with "Finishing in 2s…". He can't tell which exercise and runs out of time.
- **Plan fill rows** `views/Plan.jsx:119-125`: slot label ("Squat") is the row text, the pick (`${pick.name} · ${pick.label}`)
  is grey meta. Day C of the 3-day plan (`Squat · Chest press · Pull-down · Core`) repeats slots of A/B but starts at
  "Choose", so Sam re-picked 3 exercises he'd just chosen.

## Change
1. **Offer names the exercise and says it plainly.** Row: exercise name (primary text), then meta:
   - routine has kg: **"You lifted 32.5 kg · routine says 30 kg"**
   - routine blank: **"You lifted 30/35/35 kg · not in the routine yet"**
   Button: **"Save to {routineName}"**. `(unconfirmed)` wording.
2. **After the tap, a confirmation replaces the button:** "Saved to {routineName}." View state only, no persisted field.
3. **Auto-finish waits while an offer is open** `(unconfirmed)`: if any offer is shown at mount, no countdown; a primary
   **"Finish"** button (the same `commit()` as the countdown) replaces "Finishing in Ns…". With no offers: unchanged.
4. **Plan fill rows show the pick first:** picked → row text = exercise name, meta = slot label + plan line; unpicked → slot
   label, meta "Choose"; skipped → slot label, "Skipped".
5. **A slot inherits the same slot's pick from an earlier day** `(unconfirmed)`: when a slot key (e.g. `squat`) is picked
   in one day and the same key in a later day is still unset, it shows that pick pre-filled, changeable and skippable. An
   explicit pick or skip is never overwritten.

## Out of scope
Blank kg accepted on Complete; a sanity check on big kg jumps; move to the next exercise; "last time" when an offer was
skipped (DEC-096 §5) — all on Emilio's list. Remaining jargon ("Loop", "Import", "Volume", "Duration (s)", slash weights).
`recommendationReason` in the snapshot (unused text).

## Steps
1. `routine-offer.jsx`: exercise name from the item; new text; keep the row rendered with the confirmation after
   `applyRoutineUpdate` even though `routineUpdateOffer` then returns null (track offered items at mount).
2. `auto-complete.jsx`: compute the offered set once at mount; if non-empty, don't start the interval; render a primary
   Finish calling the same `commit()`. Edit/Cancel unchanged.
3. `Plan.jsx`: row text/meta swap; carry-forward as a pure helper in `plan-templates.js`, unit-tested.
4. Tests `src/req-182.test.js`; `./check --smoke`.

## Acceptance criteria
1. Overview offer for Chest Press, routine [30], logged [32.5]: reads "Chest Press", "You lifted 32.5 kg · routine says
   30 kg", button "Save to Full body A"; tap → "Saved to Full body A.", routine [32.5] in v9 (rendered test).
2. Routine blank → "not in the routine yet".
3. **Auto-finish with an offer:** no "Finishing in" text; after 15 s (fake clock) nothing committed; Finish → committed
   exactly once. **Failure case:** with no offers the countdown still commits at 0 (req-116 unchanged).
4. Two offers on the summary name two different exercises.
5. Plan: Leg Press for A's Squat → A's row reads "Leg Press"; C's Squat shows Leg Press pre-filled; changing C leaves A;
   skipping C's Squat saves no item there; a C pick made before A's is not overwritten.
6. Browser (Planner, 390×844): the auto-finish summary with two offers — readable, both named, Finish visible.
7. `./check --smoke` green; test edits named and justified.

## READY checks
1. DECs: DEC-096 (never automatic — Finish still never writes the routine), DEC-056, DEC-098, req-116, DEC-093.
2. Siblings: none in flight. 3. Deferrals: Out of scope. 4. Numbers: none.
5. Trigger files: none expected. If `store.jsx` or `workout-log.js` is touched, the reviewer runs.
6. Behaviour calls marked `(unconfirmed)`.
