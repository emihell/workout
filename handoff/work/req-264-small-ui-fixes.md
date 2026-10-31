**Status: BUILT, NOT merged — branch `req-264` (…`f0127f1`)** · **Lane: ui** · DEC-155 §2 (a, b decided), DEC-097 §4, DEC-017, DEC-092, req-242, req-220, req-215, req-180. After req-263 (both touch `src/views/Routine.jsx`). Touches `store.jsx` → reviewer.

# req-264 — small UI fixes from reviews: Change exercise across types, import highlight, Days row, Burpee, two checks

Five review leftovers (BACKLOG §Phase 1 "Small issues", re-checked against `main` `4c1121b` on 2026-10-31). Each is small;
they ship together because each is a few lines and none changes stored shapes.

## (a) Change exercise to another kind with no history → the new kind's starting plan (DEC-155 §2, decided)

**Repro** [measured, `changedRoutineItem`, `src/routine-item-change.js:11-24`, no workouts]:
```
strength→cardio: {"id":"i1","exerciseId":"rower","sets":3,"targets":["8","8","8"],"suggestedWeights":[],"restSec":120,"notes":"n","role":"main"}
timed→strength:  {"id":"i2","exerciseId":"squat","sets":3,"targets":[],"durations":[30,30,30],"restSec":60,...}
```
Add's plan for the same picks is `pickerItem` (`src/routine-picker.js:108-138`): cardio → 1 set, `targets: []`, rest 0;
timed → `STARTING_SETS` × the exercise's seconds, rest `STARTING_REST_SEC`; reps → its starting plan. The picker row
says `CHANGE_KEEPS_LABEL` "Keeps sets, reps and rest — kg blank" for every no-history pick (`Routine.jsx:670-701`).

**Scope:** "kind" = the plan kind `pickerItem` branches on — cardio (`type === 'cardio'`), timed (`hasDuration`), else
reps. A no-history change **to a different kind** takes the `pickerItem` starting plan's `sets`, `targets`, `durations`,
`restSec`, `suggestedWeights: []`, keeping the item's `id`, `notes`, `role`, `warmup`. **Same kind** → today's behaviour.
**With history** → today's behaviour (history's prescription). The selected row's label says what will happen: the
starting-plan label for a kind change, `CHANGE_KEEPS_LABEL` for same kind. `changedRoutineItem` needs the old and new
exercise records (the store passes ids today, `store.jsx:108-110`).

## (b) Import sheet: "Keep my history" is the highlighted choice (DEC-155 §2, decided)

**Repro** [read]: `IMPORT_CHOICES` (`src/import-backup.js:147-150`) marks Replace `destructive: true`, which renders
`ui-btn--primary` (filled); Keep renders `ui-btn--secondary` (`src/ui/index.jsx:352-360`). Keep is already first and the
default answer. **Scope:** Keep wears the filled primary look; Replace wears the secondary look. Other `askChoice` sheets
(Schedule, Plan, Today, item, overview — none set `destructive`) unchanged.

## (c) Days row in a multi-week loop

**Repro** [measured, `routineScheduledDaysText`, `src/state-reducers.js:43-50`]:
```
4-wk loop, Mon/Wed/Fri every week: Mon (week 1), Wed (week 1), Fri (week 1), Mon (week 2), … Wed (week 4) and Fri (week 4)
2-wk loop, Mon both weeks + Thu wk 1: Mon (week 1), Thu (week 1) and Mon (week 2)
```
Read by the Days row (`daysRowText`, `src/schedule-days.js:34-36` → `Routine.jsx:176-184`) and the delete confirm
(`Routine.jsx:292`). **Scope:** a weekday on in **every** loop week is named once, bare ("Mon"); a weekday on in only some
weeks keeps its week(s): `Mon, Wed and Fri` / `Mon and Thu (week 1)`. Mon-first order; one-week loops unchanged. Both
readers get the new text.

## (d) Picker: Burpee listed under Chest

**Repro** [measured, `staplesByMuscle` over `src/library/exercises.json`]: `Chest: Burpee` — its `muscleGroups` is
`["Chest","Legs"]` (primary `quadriceps, chest`, `src/library/common.js:202`) and the empty-search list takes the first
group in `MUSCLE_GROUPS` order (`src/routine-picker.js:38-47`, "(confirmed DEC-155 §4)" there). A general "first primary muscle"
rule was measured and **rejected**: it moves 11 of 194 staples, several worse (Mountain Climbers Core→Legs, Close-Grip
Bench Chest→Arms, Bird Dog Back→Core). **Scope:** a small per-id override for the picker's grouping only:
Burpee → **Legs**. No other staple moves (assert the full grouping is identical except Burpee).

## (e) Two browser checks — fix only if reproduced on the branch build

1. **Abandon below the fold** with the overview note open on a long routine (`src/views/workout/overview.jsx:234-256`:
   note → Finish → Abandon). Check at 390×844 with a 9-item routine and a 4-line note. If Abandon needs a scroll while
   Finish doesn't, report it with a screenshot; a fix is in scope only if it is layout-only.
2. **`.ui-navlink` inset** (`src/ui/ui.css:219`, `padding: 0 var(--ui-s1)`): a link whose text wraps to two lines — does
   the second line start left of the first? Same rule: report with a screenshot; fix only if CSS-only.

## Out of scope

- Same-kind changes, changes with history, and Swap in a workout (DEC-106) — unchanged.
- A danger colour or new button variant (DEC-017: grayscale; no new variant).
- Loop-length re-anchoring (BACKLOG, open) and any change to which slots exist.
- Regrouping any staple but Burpee; a "Full body"/"Cardio" picker group.

## Steps

1. (a) unit tests over `changedRoutineItem` first (fail on main for the kind change), then the store wiring and the label.
2. (b), (c), (d) — each with a test that fails on main.
3. (e) on the branch build (`plan qa`), screenshots in the report.
4. Browser run of the test list below; smoke.

## Test list (Planner runs these on the branch build)

1. Routine with Squat 3 × 8 → Change exercise → a never-logged rower: row says the starting-plan label; after Change the
   item reads 1 set, rest 0, note kept.
2. Plank 3 × 30 s → Change → a never-logged machine press: 3 sets of reps, no seconds field, note kept.
3. Leg press → Change → a never-logged chest press (same kind): "Keeps sets, reps and rest — kg blank", plan kept.
4. Change to an exercise **with** history (any kind): history's plan, as today.
5. Settings → Import a file that changes history: Keep my history is the filled button, Replace the outlined one; Keep
   still the default.
6. A 4-week loop with a workout on Mon/Wed/Fri every week: Days row reads "Mon, Wed and Fri"; its Delete confirm says
   "This removes it from Mon, Wed and Fri."
7. Same loop, one extra Thu in week 2 only: "Mon, Wed, Thu (week 2) and Fri" (Mon-first order).
8. Add exercise, empty search: Burpee under Legs, not Chest.
9. (e1) and (e2) with screenshots.

## Acceptance criteria

1. (a) **Fails on main, passes on branch:** strength→cardio and timed→reps with no history give the `pickerItem` starting
   plan with `id`/`notes`/`role`/`warmup` kept; same-kind and with-history cases byte-identical to main (asserted).
2. (a) **Failure case — the exercise record is missing** (an id not in `exercises`): the change behaves as today (no throw,
   no reset).
3. (b) the import sheet's Keep button has the primary class and Replace doesn't (rendered test); `importMode` answers
   unchanged.
4. (c) the two repro inputs give the collapsed text; a 1-week loop and an unscheduled routine read as on main (asserted).
5. (d) staple grouping identical to main except Burpee → Legs (a full-map diff test, not a grep).
6. The test list run on the branch build, each item with what the screen showed; `./check` green.

## Checks run

1. DECs grepped: DEC-155 §2 (a, b), DEC-097 §4 (Add's one-source plan), DEC-106 (Swap pattern), DEC-017 (grayscale, no
   danger variant), DEC-119 §4 / req-215 (Days row), DEC-092 (Routine nav, via req-263). req-220 review round 1 chose the
   filled Replace; DEC-155 §2 reverses that.
2. Siblings: **req-263** first (`Routine.jsx`, `routine-nav.js`); this rebases. Nothing else open touches these files.
3. Deferrals: none.
4. Numbers: the repro commands above, 2026-10-31; "11 of 194 staples" from the same run.
5. Trigger: `store.jsx` (the change wiring) → independent reviewer. Stored records are written only by the user's own
   Change tap, no bulk write → no backup reminder.
6. (confirmed DEC-155 §4) calls: below.

## Decisions made on Emilio's behalf

- **behaviour (confirmed DEC-155 §4):** "kind" = cardio / timed / reps; machine ↔ free ↔ bodyweight is the same kind (plan kept).
- **behaviour (confirmed DEC-155 §4):** the kind-change plan keeps the item's note, role and warm-up switch.
- **behaviour (confirmed DEC-155 §4):** Replace everything wears the plain secondary look — no other "destructive" marking.
- **behaviour (confirmed DEC-155 §4):** Days row wording — every-week days bare, partial days with "(week N)", e.g.
  "Mon, Wed, Thu (week 2) and Fri"; same text in the delete confirm.
- **behaviour (confirmed DEC-155 §4):** Burpee's picker group is **Legs**.
- **behaviour (confirmed DEC-155 §4):** (e) fixes only if layout/CSS-only; anything bigger goes back to BACKLOG.
- **implementation:** where the override map lives; how the store hands exercise records to `changedRoutineItem`.
