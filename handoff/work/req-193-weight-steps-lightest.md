# req-193 — weight steps you can set: two step sizes, and the lightest weight

**Status: BUILT, NOT merged** (2026-10-06). **Lane: ui** (+ load-recommendation logic). From DEC-108 §6 (G2 "What does alternating
mean?", G6 "I can't change the increment?", G7 "The increment should also have a starting weight"). After **req-192**.
Trigger files: **`progress.js`** → independent reviewer before merge. Exercise records gain optional fields; **no migration,
no rewrite** — every stored value reads exactly as today.

## Code today (main `4da90e1`)
- `weight-step.js`: stored `weightStep` is a number string ('2.5'), `ALTERNATING = 'Alt 4/5'`, or 'n/a'; editor fields
  `weightStepFields` (`:30-38`). Editor `views/weight-step-field.jsx`: the increment box is `disabled={fields.alternating}`
  (`:15`) — why Emilio couldn't change it. Shown for cardio too (no type gate). Used in `views/workout/setup.jsx` (in-workout
  exercise screen) and `views/Exercises.jsx` (full editor).
- `progress.js` `validWeights` (`:5-28`): `weightOptions` if present; Alternating → fixed series **from 9 kg**, +5/+4;
  single step → **from the step itself** (5 → 5, 10, 15 …). `moveToValidWeight` snaps recommendations to that series.
- Prior art: MacroFactor / Alpha Progression model a stack as start–end–step ranges (req-184 research).

## Scope (ordered)
1. **Editor wording:** "Weight step (kg)"; the option "Alternating (4/5)" → **"Two step sizes"** with two editable boxes (e.g.
   4 and 5) shown when on; a one-line help "e.g. machines that go 4, 5, 4, 5 kg" `(unconfirmed)`. Hidden for cardio.
2. **"Lightest weight (kg)"** — optional box: the stack's first weight. Stored as a new optional exercise field.
3. **Recommendations count from the lightest weight:** series = lightest, lightest + step, … (or alternating the two steps).
   Lightest blank → today's behaviour exactly (single step from the step; 'Alt 4/5' from 9). A stored 'Alt 4/5' reads as
   two steps 5 then 4 from 9 — byte-identical output to today for every existing exercise.
4. Two step sizes stored in a form `parseWeightStep`'s neighbours can read (e.g. 'Alt 2.5/5'); 'Alt 4/5' stays valid.

## Out of scope
A max weight / ranges / plates. Changing how effort moves the load.

## Acceptance
1. Unit (golden): for every exercise in `src/db.json` and a library sample, `validWeights` with no lightest weight equals
   main's output (import main's function from a fixture copy, as req-150/158 did).
2. Unit: step 5, lightest 7.5 → 7.5, 12.5, 17.5; two steps 2.5/5 from 10 → 10, 12.5, 17.5, 20, 25; a recommendation of
   "one step up" from 12.5 → 17.5.
3. **Failure case:** lightest "abc" / negative / larger than 250 → inline error, nothing saved; step blank + lightest set →
   no series (hold, DEC-030) — never an invented step.
4. Browser: in-workout exercise screen → turn on Two step sizes → both boxes editable → save → stored value read back.
5. Cardio exercise: no weight-step fields shown.
6. `./check` green; reviewer's verdict quoted.

## Decisions made on Emilio's behalf `(unconfirmed)`
Labels and help text; field name; the stored form for two steps; hiding for cardio.

## Built — calls `(unconfirmed)` and behaviour changes
Typed two steps store as `Steps A/B` (A first); legacy 'Alt 4/5' = 5 then 4 from 9, kept byte-identical (incl. a 5/4 re-save).
"Lightest weight (kg)" → `lightestWeight`; preview line "Weights: 10, 12.5, 17.5 …" / "No step set — suggestions hold" /
"Suggestions keep the same kg" (bodyweight/assisted). **Behaviour changes vs main:** (a) a failed set below the series start
holds instead of jumping up to the first weight; (b) a down that can't move reads `keep` + "Already at the lightest weight —
kept as is." (reason not shown on any screen yet, DEC-076 gap). Lightest 0 is an error; New 'Steps' with no lightest count from 0.
