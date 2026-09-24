# req-133 — library tagging pass: the ~150 common exercises on the new structure (DEC-062)

**Status: BUILT, NOT merged — branch `req-133`** — Phase 1, **data only**. **Gate: functional** (library data + generator + tests; no stored-data
change, no store/model touch). Builds on req-130 (live). Spec reviewed independently 2026-09-24 (10 findings folded
in; split: the **text** — description/cues/steps/mistakes — moved to **req-138**, which feeds req-131). Emilio
2026-09-24: "fill in info that is obvious to you, improve text if needed, add aliases that you know are used a lot";
clean start, not bent to his data (DEC-063). Unlocks req-134 (browse + muscle filter), req-135 (alternatives).

## Why [measured 2026-09-24 on `main`, `src/library/exercises.json`]

879 entries, 24 with aliases; 17 coarse muscles; equipment blank on 77, "other" on 122; no movement pattern, no
"common" flag. Every feature Emilio listed reads these, so they're fixed once on a fixed structure first.

## Hard constraints (from the live code)

- **free-db fields are never edited**, `name` included. `exerciseLibrary.test.js:37-44,68-71` strips `OWN_FIELDS`
  and sha256-compares to the pinned source — it must stay green. Corrections live **only in our new fields**
  (`equipmentList`, `logAs`, `pattern`, `muscles`). level/category are not corrected in this req.
- **No reader changes.** `exerciseCatalog.js` (search, `catalogItemToExercise`, `inferExerciseType`) and
  `muscleGroupsFor` keep reading what they read today; the new fields have **no consumer** until req-134/135/132.
  The only user-visible effect is search ranking from new aliases (receipted below).
- **`own-*` entries carry the legacy fields too**, in free-db vocabulary (`equipment`, `category`,
  `primaryMuscles`/`secondaryMuscles` from the req-130 table's 19 strings, `instructions`), so today's readers keep
  working (`muscleGroupsFor` throws on unknown strings, `exerciseLibrary.js:51-58`; `catalogItemToExercise` needs
  equipment/instructions).

## The structure (DEC-062 — fixed lists; a test rejects anything off them)

**1. Muscle tree** — `id` (aliases). Choosing a node includes everything under it.

```
arms (arm)        biceps (bicep) · triceps (tricep) · forearms (forearm, grip) · brachialis
shoulders         deltoids (delts, deltoid) → front-delt (front delts, anterior deltoid) ·
                    side-delt (side delts, lateral deltoid, medial deltoid) · rear-delt (rear delts, posterior deltoid)
                  rotator-cuff · neck
chest             pecs (pectorals, pec) → upper-chest (clavicular) · mid-lower-chest (lower chest, sternal)
back              lats (latissimus, lat) · traps (trapezius, trap) · rhomboids (upper back, mid back) ·
                    lower-back (erectors, erector spinae)
core              abs (abdominals, stomach, six pack, rectus abdominis) · obliques (side abs) · hip-flexors (iliopsoas)
legs (leg)        quads (quadriceps, quad, front thigh) · hamstrings (hamstring, hams) ·
                    glutes (glute, butt, gluteus) → glute-max (gluteus maximus) · glute-med (gluteus medius) ·
                    calves (calf, gastrocnemius, soleus) · adductors (inner thigh) · abductors (outer thigh)
```
- **Keys** = `catalogNameKey` of each node's id, label and aliases. **Unique across nodes**; duplicates within one
  node are fine. ("shoulders"/"chest" are the groups; the muscle below is covered by inclusion.)
- **Tagging level:** tag the **finest node that is true**. A node with parts may be tagged itself when the movement
  hits all its parts about equally (e.g. `deltoids` for a press that hits front + side) — no forced split.
- free-db → tree (for the consistency test): chest→pecs, lats→lats, middle back→rhomboids, lower back→lower-back,
  traps→traps, shoulders→deltoids, neck→neck, biceps→biceps, triceps→triceps, forearms→forearms, abdominals→abs,
  quadriceps→quads, hamstrings→hamstrings, glutes→glutes, calves→calves, abductors→abductors, adductors→adductors;
  extras: rhomboids→rhomboids, rear delts→rear-delt. No serratus/tibialis (deliberate).

**2. Movement pattern** (exactly one): `squat` `hinge` `lunge` `bridge` `hip-extension` `horizontal-push`
`vertical-push` `horizontal-pull` `vertical-pull` `pullover` `fly` `raise` `curl` `elbow-extension` `leg-curl`
`leg-extension` `hip-abduction` `hip-adduction` `calf-raise` `shrug` `carry` `core-flexion` `core-stability`
`core-rotation` `cardio` `plyometric` `olympic` `mobility`. Upright row → `raise`. Kickbacks/donkey kicks →
`hip-extension`. Straight-arm pulldown → `pullover`.

**3. Equipment** (one or more): `barbell` `ez-bar` `trap-bar` (hex bar) `dumbbell` `kettlebell` `cable` `machine`
`smith-machine` `bench` (incl. preacher bench) `pull-up-bar` `dip-bars` `suspension` (TRX, rings) `roman-chair`
(GHD, captain's chair) `bands` `bodyweight` `medicine-ball` `exercise-ball` `ab-wheel` `landmine` `foam-roller`
`box` `sled` `plate` `sandbag` `battle-ropes` `jump-rope` `cardio-machine`. **Load equipment** = barbell, ez-bar,
trap-bar, dumbbell, kettlebell, cable, machine, smith-machine, landmine, sled, plate, sandbag, medicine-ball.

**4. How it's logged** (`logAs`) + `unilateral` (true when each side is its own set, e.g. one-arm row; alternating
curls where both sides go in one set = false). Mapping to the app's model (`ids.js`, `item.jsx:241,339,347`),
applied later by req-132:

| logAs | exercise type | hasDuration |
|---|---|---|
| `weight-reps` | free or machine (by equipment) | false |
| `bodyweight-reps` | bodyweight (weight forced 0) | false |
| `weight-time` | free or machine | true |
| `time` | bodyweight | true |
| `cardio` | cardio | — |

Weighted/assisted pull-ups and dips → `weight-reps`; farmer's walk, weighted plank → `weight-time`.

## The behaviour (data)

1. **Our fields, added beside free-db's** (appended to `OWN_FIELDS`): `aliases` · `muscles: [{ id, role:
   'primary'|'secondary' }]` · `pattern` · `equipmentList` · `logAs` · `unilateral` · `common: true` · `family`.
   (Text fields are req-138. Note for req-132: the library's future `cues` ≠ the stored `exercise.cues`.)
2. **`muscleGroups`:** tagged entries emit **the same labels and order as today's `MUSCLE_GROUPS`**
   (`Chest, Back, Shoulders, Arms, Legs, Core`), derived from their primary tree tags; untagged entries keep the table.
3. **`family`:** kebab-case, its own namespace, prefixed `fam-` (e.g. `fam-leg-curl` for Seated/Lying/Standing Leg
   Curl). Only common entries get one in this req; a family has ≥2 members or equals `fam-` + the entry's own id.
4. **Which ~150 are common:** chosen on merit (DEC-063) — commercial-gym barbell/dumbbell/cable/machine staples,
   common bodyweight/core moves, the common cardio machines; one entry per real variant, no near-duplicates;
   `own-hanging-knee-raise` stays. Target 130–170. A missing common exercise may be added as `own-*` (all fields,
   legacy ones included). The report lists it as a table.
5. **Aliases on merit:** names gym-goers really use for **that exact entry** (RDL, OHP, DB/BB forms, "skull crusher",
   "hip thrust"…). **Never a bare "Press", "Row" or "Machine"** (the req-130 review tests must stay green).
   req-130's seed aliases (DEC-063) are re-judged: drop at least the tagged forms ("Pull-Ups (BW)", "Dips (BW)",
   "Calf Raises (Leg Press)") and the misleading ones (Triceps Press → Dip Machine, Biceps Curl → Machine Bicep Curl,
   Shoulder Press → Machine Shoulder Press). Report table: each seed alias kept/dropped + reason. Alias keys are
   unique across entries and never another entry's name key.

## Search receipts (written before the build — library list only, no RepDB)

Expected **top-1** after the build (report pastes a before/after top-3 table for all 25):
bench press → Barbell Bench Press - Medium Grip · squat → Barbell Squat · deadlift → Barbell Deadlift · rdl →
Romanian Deadlift · ohp → Standing Military Press · skull crusher → EZ-Bar Skullcrusher · db row → One-Arm Dumbbell
Row · lat pulldown → Wide-Grip Lat Pulldown · face pull → Face Pull · hip thrust → Barbell Hip Thrust · lateral raise
→ a standing dumbbell lateral raise (own-* if free-db has none — say which) · leg curl → Seated Leg Curl or Lying Leg
Curls (say which) · leg press → Leg Press · pull up → Pullups · chin up → Chin-Up · dips → Dips - Triceps Version
or Dips - Chest Version (say which) · plank → Plank · push up → Pushups · cable fly → Cable Crossover · preacher curl
→ Preacher Curl · hammer curl → Hammer Curls · t-bar row → T-Bar Row with Handle · farmer walk → Farmer's Walk ·
treadmill → Running, Treadmill · rowing → Rowing, Stationary. A different top-1 is allowed only with a one-line reason.

## Scope

`src/exerciseLibrary.js` (constants, validators, derive), new content file(s) under `src/library/` (DEC-061
amended: authored data may live in data files merged by `deriveLibrary`), `scripts/build-library.mjs` if needed,
`src/library/exercises.json` (regenerated), tests. **Not** `exerciseCatalog.js` except as tests need. Batching the
authoring across agents is the builder's call.

## Out of scope

Text fields (req-138). Any screen or reader change (req-134/135/132/131). Editing free-db fields. Correcting
level/category. Stored user exercises. Swedish. Non-common entries. Images.

## Acceptance criteria (written before implementation)

- **Provenance untouched:** stripping `OWN_FIELDS` gives the pinned source byte-identical (existing test, green).
- **Fixed lists enforced:** every `muscles[].id`, `pattern`, `equipmentList[]`, `logAs` is from the lists; a failing
  fixture proves the test fails on an off-list value.
- **Tree:** every node chains to a group; keys unique across nodes; the free-db→tree map covers all 19 strings.
- **Complete common entries:** each has ≥1 primary muscle, exactly one pattern, ≥1 equipment, `logAs`,
  `unilateral`, `family`. Count 130–170. Test.
- **Consistency (a bad tag fails):** pattern ⇒ required primary (`curl`⇒biceps/brachialis/forearms;
  `elbow-extension`⇒triceps; `leg-curl`⇒hamstrings; `leg-extension`⇒quads; `calf-raise`⇒calves; `shrug`⇒traps;
  `horizontal-pull`/`vertical-pull`⇒lats/rhomboids/traps/rear-delt); `bodyweight-reps`/`time` ⇒ no load equipment;
  `weight-reps`/`weight-time` ⇒ ≥1 load equipment; `cardio` pattern ⇔ `cardio` logAs; `equipmentList` contains the
  obvious map of free-db `equipment` (e-z curl bar→ez-bar, kettlebells→kettlebell, body only→bodyweight, …) or the id
  is in an allow-list with a reason; the tree groups ⊇ the table groups of the entry's free-db primaryMuscles, or the
  id is in an allow-list with a reason.
- **Sanctioned test edits (DEC-063), exactly these:** in `exerciseLibrary.test.js` — the `SEED_TABLE` / "all 22 seed
  names resolve" test (`:143-150`) becomes the kept subset + an assertion that each dropped name resolves to `null`
  (or its new target); the six seed-alias queries (`:171-181`) keep only kept aliases; the fall-through test (`:162`)
  and the rename test (`:314-329`) switch to a kept alias if theirs is dropped; the entry-count test (`:73-76`) becomes
  `876 + extras + N own-*` with N reported. **Every other existing test is unedited**, including the three
  "top 10 identical with and without aliases" tests (`press`/`row`/`machine`, `:189-201`).
- **Search receipts:** the 25 queries above as a test (top-1), plus the before/after table in the report.
- **Review dump:** the report includes a one-line-per-common-entry TSV (id, name, pattern, equipmentList, primary,
  secondary, logAs, unilateral, family) — planning reviews that, not the JSON.
- **No RepDB:** `grep -ci repdb src/library/exercises.json` → 0.
- `./check` green; paste the line. Library chunk size before/after (informational; flag if > 1.6 MB).

## Decisions made on Emilio's behalf

- confirmed 2026-09-24: the tree, muscle aliases, ~150 common scope, the field set; seed aliases re-judged (DEC-063).
- **(unconfirmed)**: the exact pattern/equipment/logAs lists (incl. `weight-time`); hip flexors under Core, neck under
  Shoulders; tagging a parent when parts are hit equally; the text split into req-138; non-common entries untouched.
- implementation: content file format, batching, validator shape — builder's call.
