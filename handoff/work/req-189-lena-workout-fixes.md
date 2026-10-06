# req-189 — first-workout fixes from the Lena run, and Swap copies sets/rest

**Status: BUILT AND MERGED, 2026-10-06 — branch `req-189` (`bee2be0`…`407e65c`, 2 commits).** (2026-10-06). **Lane: ui.** From req-184 §Persona run (Lena, 2026-10-06) and DEC-106. Siblings: **req-190**
(setup) touches different screens; order 189 → 190, both off `main`. Trigger files: likely none (`mid-workout-pick.js`,
views, `ui/`); if `workout-log.js` / `store.jsx` / `state-reducers.js` change → independent reviewer.

## Code today (main `ad04375`, read this session)
- Swap with no history → Sets/Rest step: `needsSetup` (`mid-workout-pick.js:10`) for any non-history pick; `noHistoryItem`
  `:15-30`; screens `views/workout/mid-workout-picker.jsx`.
- Routine-kg sheet words: `offerSheetText` (`routine-update-offer.js`, req-187): "Update {exercise}?" / "You lifted 40 kg ·
  not in Full body A yet" / [Keep blank] [Update routine].
- Auto-complete: "Finishing in {n}s…" (`views/workout/auto-complete.jsx:98`), [Edit] (`:111`), [Cancel] (`:118`, stops the
  countdown, nothing finished); stat row `{ label: 'Volume', value: '… kg' }` (`:81`). History already says "… kg lifted"
  (`views/history/detail.jsx:56`).
- Set form: kg is `NumberField label="kg"` (`ui/index.jsx:518`); Reps is a `Field … required` (`:528`) → the browser's own
  "Please fill out this field" bubble when Reps is empty (Lena, swapped exercise with no target). `NumberField`
  (`ui/index.jsx:136`) does not select its value on focus → typing appends ("12" into "10" → "1012"/"1120").
- Overview row of a swapped-away exercise reads " · skipped" (`views/workout/overview.jsx:206`, `itemAllSkipped`).

## Scope (ordered)
1. **DEC-106 — Swap, no history:** no step. The new item copies the replaced item's `sets` and `restSec`; reps targets, kg,
   durations blank. Swap with history unchanged (history's plan). **Add exercise unchanged** (keeps DEC-104's step).
2. **Number boxes select their content on focus** (kg, reps, and the other `NumberField`/numeric `Field`s on the set form and
   set-edit), so the first keystroke replaces the value.
3. **Empty Reps on Complete:** no browser bubble. Reps blank on a reps exercise → an inline note under the box "Enter reps"
   and Complete does nothing (app styling, like the existing kg notes). No prefilled reps (DESIGN §1).
4. **Routine-kg sheet in plain words** (`unconfirmed`): title "Use 40 kg next time?"; body "Full body A will start Leg Press
   at 40 kg."; buttons [No] (left) [Yes] (right). Per-set lists keep `kgSummary` ("40/40/35 kg").
5. **Auto-complete words** (`unconfirmed`): [Cancel] → **[Keep going]** (same action); "Volume" → **"Lifted"** with value
   "2,630 kg" (`toLocaleString`, as History). [Edit] unchanged.
6. **"kg" label on a dumbbell exercise reads "kg per dumbbell"** when the exercise's equipment is dumbbell(s) — check the
   stored equipment values in `src/exerciseLibrary.js` / the user's records first and match them all; elsewhere "kg".
7. **A swapped-away exercise reads " · swapped"** on the overview (and History, if it shows the same label), not
   " · skipped"; a genuinely skipped one keeps "skipped". Derive it from the data (the item right after it has
   `replacesItemId` = its key) — no new stored field.

## Out of scope
- First-time setup / plan / Home (req-190). Rest editing mid-exercise (BACKLOG). Big-number guard with no reference (Lena's
  150 kg on a first-ever set; DEC-102 needs a reference — not changed). Workout clock.

## Acceptance
1. Unit: Swap pick without history → item `sets` = original's, `restSec` = original's, `targets [] suggestedWeights []`;
   with history → history's plan; Add without history → still `needsSetup` true.
2. Browser: ⋯ → Swap → a never-done library exercise → lands on its log screen, **no step**; stored item sets/rest equal
   the original's (receipt).
3. Browser: on a set form with Reps "10", focus Reps and type "12" → field reads "12".
4. **Failure case:** Reps blank → Complete → inline "Enter reps", no set stored (`sets.length` unchanged, receipt), no native
   validation bubble (`reportValidity` not triggered — check no `:invalid` popup via a `required` attribute left on the input).
5. Browser: sheet reads "Use 40 kg next time?" with [No] [Yes]; Yes → routine kg written; No → unchanged (receipts).
6. Auto-complete shows "Lifted 2,630 kg" and [Keep going]; Keep going behaves as Cancel did (receipt `autoFinishDismissed`).
7. A dumbbell exercise's set form label reads "kg per dumbbell"; a machine's reads "kg".
8. **Failure case:** an exercise skipped with ⋯ → Skip reads "· skipped"; one swapped away reads "· swapped".
9. `./check` green; smoke green (update smoke if it reads changed words, and say so).

## Decisions made on Emilio's behalf `(unconfirmed)`
All wording in 3–7; select-on-focus everywhere numeric on the set screens; "swapped" label.

## Built — calls `(unconfirmed)`
Swap picker row for a never-done exercise: "No history — same sets and rest"; blank Duration → "Enter duration"; Swap copies
the original's current set count (incl. added sets), not its warm-up; "kg per dumbbell" keyed on "dumbbell(s)" in equipment
(hand-typed "DB" reads "kg"); also on live set-edit, not History edit; select-on-focus may leave a cursor on iOS (real device).
