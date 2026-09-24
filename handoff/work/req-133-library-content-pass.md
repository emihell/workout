# req-133 — library content pass: the ~150 common exercises, tagged on the new structure (DEC-062)

**Status: READY** — Phase 1, data only (no screen changes; search picks up the new aliases through the existing
`aliases` scoring). **Gate: functional** (library data + generator + tests; no stored-data change, no store/model
touch). Builds on req-130 (live). Emilio 2026-09-24: "you can also fill in info that is obvious to you, and improve
text if needed, or add aliases that you know are used a lot." Unlocks req-131 ("How to" text), req-134 (muscle
search/filter), req-135 (alternatives), and Phase 2 programs.

## Why

The library has 879 entries but only 24 have aliases; muscles are 17 coarse values (one "shoulders", one
"abdominals"); equipment is blank on 77 and "other" on 122; there is no movement pattern, no "common" flag, and the
text is free-db's long instructions [measured 2026-09-24 on `main`, `src/library/exercises.json`]. The features Emilio
listed (search by any name, beginner "arm" search and advanced "rear delt" search, alternatives, programs) all read
these fields, so they get fixed once, on a fixed structure, before any of those screens are built.

## The structure (DEC-062 — the fixed lists; a test rejects anything off them)

**1. Muscle tree** — tag at the finest level; parents are derived. `id` · label · parent · search aliases (English):

```
GROUP        MUSCLE                          PART
arms         biceps  (bicep)
             triceps (tricep)
             forearms (forearm, grip)
             brachialis
shoulders    deltoids (delts, deltoid,  →    front-delt (front delts, anterior deltoid)
               shoulder, shoulders)          side-delt  (side delts, lateral deltoid, medial deltoid)
                                             rear-delt  (rear delts, posterior deltoid)
             rotator-cuff (rotator cuff)
             neck
chest        pecs (chest, pectorals,    →    upper-chest (upper chest, clavicular)
               pecs)                         mid-lower-chest (lower chest, sternal)
back         lats (latissimus, lat)
             traps (trapezius, trap)
             rhomboids (upper back, mid back)
             lower-back (lower back, erectors, erector spinae)
core         abs (abdominals, stomach, six pack, rectus abdominis)
             obliques (side abs)
             hip-flexors (hip flexors, iliopsoas)
legs         quads (quadriceps, quad, front thigh)
             hamstrings (hamstring, hams)
             glutes (glute, butt, gluteus) → glute-max (gluteus maximus) · glute-med (gluteus medius)
             calves (calf, gastrocnemius, soleus)
             adductors (inner thigh)
             abductors (outer thigh)
```
Group aliases: arms (arm) · shoulders (shoulder is on deltoids — the group answers "shoulders" too) · chest ·
back · core (abs is on the muscle) · legs (leg). **Every alias key is unique across the whole tree** (test); a word
that fits two levels goes on one, and choosing a level includes everything under it.

**2. Movement pattern** (exactly one per entry): `squat` `hinge` `lunge` `bridge` `horizontal-push`
`vertical-push` `horizontal-pull` `vertical-pull` `fly` `raise` `curl` `elbow-extension` `leg-curl`
`leg-extension` `hip-abduction` `hip-adduction` `calf-raise` `shrug` `carry` `core-flexion` `core-stability`
`core-rotation` `cardio` `plyometric` `olympic` `mobility`.

**3. Equipment** (one or more): `barbell` `ez-bar` `trap-bar` `dumbbell` `kettlebell` `cable` `machine`
`smith-machine` `bench` `pull-up-bar` `dip-bars` `suspension` `bands` `bodyweight` `medicine-ball`
`exercise-ball` `landmine` `foam-roller` `box` `sled` `plate` `cardio-machine`.

**4. How it's logged:** `logAs` ∈ `weight-reps` `bodyweight-reps` `time` `cardio` (the app's existing type +
`hasDuration` model — no new logging kinds), plus `unilateral: true|false` (one side at a time).

## The behaviour (data)

1. **Our own fields, added beside free-db's** (free-db's original fields stay byte-unchanged, so req-130's
   provenance test keeps meaning something; the app reads ours where present):
   `aliases` · `muscles: [{ id, role: 'primary'|'secondary' }]` (ids from the tree, finest level) ·
   `muscleGroups` (derived from primary muscles via the tree — replaces req-130's table for tagged entries) ·
   `pattern` · `equipmentList` · `logAs` · `unilateral` · `common: true` · `family` (variant family id, e.g.
   `leg-curl` for Seated/Lying/Standing Leg Curl) · `description` (one line) · `cues` (2–3 short in-gym lines) ·
   `steps` (clear instructions) · `mistakes` (1–3).
2. **Which ~150 are "common":** the exercises a normal commercial gym uses (barbell/dumbbell/cable/machine staples,
   common bodyweight and core moves, the common cardio machines). Chosen on merit, not from Emilio's exercises
   (DEC-063); `own-hanging-knee-raise` stays as a real exercise. The builder proposes the list; it lands in the report as a table for review.
   Target 130–170; no padding with near-duplicates — one entry per real variant.
3. **Fill it well** (Emilio's licence): fix obvious equipment/level/category errors, add aliases that are really
   used (RDL, OHP, DB/BB forms, "skull crusher", "face pull"…), rewrite text clearer and shorter. A common gym
   exercise missing from free-db may be added as `own-*` (same fields, no photos).
4. **Text is ours.** Written from free-db's (public-domain) instructions + general training knowledge. **Never from
   RepDB** — don't open RepDB text while writing (DEC-060 §3).
5. **Seed aliases lose their special status (DEC-063 — the library isn't bent to Emilio's data).** req-130's
   `SEED_ALIASES` (Emilio's 22 names, verbatim) are re-judged on merit like every other alias: keep one only if gym-goers
   really use that name for **that exact entry**. Drop the rest — at least the tagged/parenthesised forms ("Pull-Ups
   (BW)", "Dips (BW)", "Calf Raises (Leg Press)") and the misleading ones (Triceps Press → Dip Machine, Biceps Curl →
   Machine Bicep Curl, Shoulder Press → Machine Shoulder Press: the plain name means a free-weight movement to most
   people). The report lists each seed alias kept/dropped with a one-line reason. Alias keys stay unique across entries
   and never equal another entry's name key.
6. **Non-common entries are untouched** (no new fields beyond req-130's). A later pass may extend.

## Scope

`src/exerciseLibrary.js` (tree/pattern/equipment/logAs constants, derive step), new content source file(s) under
`src/library/` (the authored per-entry data — DEC-061 amended: content may live in data files merged by
`deriveLibrary`, not only inline tables), `scripts/build-library.mjs` if needed, `src/library/exercises.json`
(regenerated), tests. Batching the authoring across agents is the builder's call.

## Out of scope

- Any screen: muscle chips/filter (req-134), alternatives (req-135), "How to" (req-131), Add screen and setting the
  exercise type from `logAs` on add (req-132). Search ranking changes beyond picking up new aliases.
- Stored user exercises (no `muscles` on them yet; that's with req-134/135 for custom exercises).
- Swedish. Non-common entries. Our own images.

## Ordered steps

1. Constants: the tree (with aliases), patterns, equipment, logAs; validators; derive groups from the tree.
2. Propose the common list (report table); author entries in batches; validators green per batch.
3. Regenerate `exercises.json`; drift + provenance tests still pass.
4. Report: the common list, 20 random entries in full, the seed-alias kept/dropped table, counts per group/pattern.

## Acceptance criteria (written before implementation)

- **Fixed lists enforced:** every `muscles[].id`, `pattern`, `equipmentList[]`, `logAs` in the library is from the
  lists above; a test fails on any other value (prove it by a failing fixture).
- **Tree integrity:** every node has a valid parent chain to a group; all alias keys unique across the tree;
  `muscleGroups` of a tagged entry = the groups of its primary muscles.
- **Complete common entries:** each `common` entry has ≥1 primary muscle, exactly one pattern, ≥1 equipment,
  `logAs`, `unilateral`, `family`, a description, 2–3 cues, ≥3 steps, ≥1 mistake. Test. Count 130–170.
- **Seed aliases re-judged:** the req-130 tests that pin the 22 seed names (resolver table, the "ab machine" /
  "stairs" / "biceps curl" / "triceps press" / "leg curl" / "hanging knee raises" queries) are **replaced, not
  weakened**: each dropped alias's test is removed with its reason in the report; each kept alias keeps its test. This
  test edit is sanctioned by DEC-063. `libraryEntryFor`'s order (id → name → alias → null) is unchanged and still tested.
- **Aliases:** unique across entries, never another entry's name key; test. Searches (test): "rdl" → Romanian
  Deadlift first; "ohp" → Standing Military Press first; "skull crusher" → EZ-Bar Skullcrusher first (today Band
  Skull Crusher can win); "db row" → a one-arm dumbbell row first. (Targets exist on `main` [measured].) The kept seed aliases' queries still pass.
- **free-db untouched:** stripping our fields gives the pinned source entry byte-identical (req-130 test, extended
  to the new field names).
- **No RepDB:** `grep -ci repdb src/library/exercises.json` → 0.
- `exerciseCatalog.test.js` and `exerciseLibrary.test.js` pass (any edit to an existing test called out and
  justified). `./check` green; paste the line. Library chunk size before/after pasted.

## Decisions made on Emilio's behalf

- behaviour, confirmed 2026-09-24 ("sounds good"): the three-level tree, muscle aliases, "either" as the later
  filter's default, the ~150 common scope, the field set.
- confirmed 2026-09-24 ("ok"): seed aliases re-judged on merit (DEC-063).
- **(unconfirmed)**: the exact pattern and equipment lists; hip flexors under Core; neck under Shoulders; the
  150-ish target; non-common entries left as they are.
- implementation: content file format, batching, validator shape — builder's call.
