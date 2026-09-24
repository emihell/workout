# req-138 — library text pass: description, form cues, steps and mistakes for the common exercises

**Status: READY** — Phase 1, **data only**. **Gate: functional** (library data + validators + tests; no reader, screen or
stored-data change). Split from req-133 by its spec review; moved before the browse screen by DEC-064 §4. Emilio
2026-09-24: "improve text if needed". Feeds req-134 (browse can show the description) and req-131 ("How to"). Spec
reviewed independently 2026-09-24 (9 findings + review aids folded in).

## Why [measured 2026-09-24 on `main`, reviewer]

178 common entries: 154 free-db, 24 own-*. free-db instructions average 746 characters, full of boilerplate ("This will
be your starting position" ×92, "Repeat for the recommended amount" ×63, "to the starting position" ×94). There are no short
cues and no mistakes. 3 common entries have **no** instructions to rewrite from: `One-Arm_Kettlebell_Swings`,
`Push_Press`, `Side_Bridge`. RepDB has descriptions and tips; we write our own (DEC-060 §3).

## The behaviour (data)

1. **Four own fields on every common entry**, added through the **tags path** (`commonExercises()` →
   `withOwnFields`' `if (tags)` block — text placed directly on an own-* entry would be silently dropped), appended to
   `OWN_FIELDS` **and** `NEW_FIELDS` (so a non-common entry carrying them is rejected):
   - `description` — exactly one sentence, ≤120 characters, ends with a period. What it is and what it trains.
   - `formCues` — 2–3 imperative reminders, each ≤70 characters, no trailing period ("Elbows under the bar"). Named
     `formCues`, not `cues`, so it can't be confused with the stored `exercise.cues`.
   - `steps` — 3–6 imperative instructions, each ≤140 characters, ending with a period; array order is the order, no
     "1." prefix. Setup → movement → finish.
   - `mistakes` — 1–3 errors described as they look, each ≤90 characters, no trailing period ("Hips rise before the
     chest").
   Every string starts with a capital and has no leading or trailing whitespace. No line repeats within an entry,
   across fields included.
2. **Style:** plain English, second person in `formCues`/`steps`. Say what to do, not why it's great.
   - **No numbers the app would be inventing.** No digits except angles ("90 degrees", "90°"). No number word + unit
     ("two seconds", "three reps", "a few breaths"). No sets×reps, kg/lb, %, or RPE. **Isometric holds** (plank, wall sit,
     side plank, hollow hold, Copenhagen plank) are `logAs: time`: the timer logs the duration, so the text never
     prescribes one ("Hold the position", "Pause at the top", "Hold briefly").
   - **Breathing cues are allowed in `steps` only (unconfirmed)**, not in cues, mistakes or description.
   - **No hype and no medical claims.**
   - **Unilateral entries** (19) mention "each side/arm/leg/hand", "other side" or "switch sides" in `steps`.
3. **Sources:** free-db's own instructions (public domain; rewrite, correct and shorten them freely) + general training
   knowledge; for the 3 empty entries, general knowledge only. **Never RepDB text:** don't open RepDB descriptions, tips
   or instructions while writing (DEC-060 §3).
4. **own-* legacy `instructions` stay as they are**, since they're what an add saves as `exercise.cues` today; changing what
   an add saves is req-132's (DEC-063 §3). **Exception:** an own-* entry whose legacy `instructions` fails the originality
   check below (>0.15) gets them rewritten from general knowledge, keeping 3–4 lines (`req-139.test.js:82` stays green).
   New adds of that entry save the new text; list which ones.
5. **Non-common entries:** untouched.

## Scope

A new text data file under `src/library/`, imported only by `exerciseLibrary.js` and reached only from
`deriveLibrary`/`commonExercises` (side-effect-free top level, L-026). Also `src/exerciseLibrary.js` (field lists,
validators), the regenerated `exercises.json`, and tests. **Not** `exerciseCatalog.js`, views or `catalogItemToExercise`.
(Authored library data living in data files: req-133 §Scope; this req confirms it.) Batching across agents is the
builder's call.

## Out of scope

Any reader or screen change. Non-common entries. Swedish. Pictures. Tag or name changes: list any tag error you find
for req-136 instead. A one-line obvious fix is allowed if you call it out.

## Validators (a test per rule, each with a failing fixture)

- **Shape:** the counts, caps and punctuation above. `description` is one sentence (no `. ` inside). Steps are rejected
  if they match `/^\s*\d+[.)]/`.
- **Boilerplate:** reject `/starting position|recommended amount|prescribed amount|this portion of the movement|as you
  perform this|^(tip|caution|variations?):/i`. Reject breath words (`/\b(inhal|exhal|breathe (in|out))/i`) outside
  `steps`.
- **Numbers:** after removing `/\b\d{2,3}(-| )?degrees?\b|\d{2,3}°/`, reject any digit. Reject
  `/\b(one|two|three|four|five|six|seven|eight|nine|ten|a few|several)\s+(seconds?|secs?|minutes?|mins?|reps?|repetitions?|sets?|times|counts?|breaths?)\b/i`.
  Reject `/\d+\s*[x×]\s*\d+/`, `/\b(kg|lbs?|%|rpe)\b/i`.
- **Hype / medical:** reject `/\b(great|best|ultimate|amazing|excellent|perfect|effective)\b/i` and
  `/\b(injur\w*|pain|prevent\w*|rehab\w*|heal\w*|therap\w*)\b/i`.
- **Unilateral:** the rule in §2.
- **Duplicates:** the same text across fields within an entry is rejected.

## Originality receipt (a one-off script, not a test — run only after all writing is committed)

- Pin a RepDB commit sha and paste it. Cache the file **outside** the repo. The script prints our line and its score,
  **never** the RepDB sentence.
- For each common entry with a same-named RepDB entry (`catalogNameKey` of shown name or alias): compute the share of our
  word-4-grams (all four fields) that appear in that RepDB entry's English text. **Flag > 0.15.** Separately, flag any
  line of ours sharing a contiguous run of **≥12 tokens** with any RepDB sentence. Rewrite every flagged item from
  free-db + general knowledge and re-run.
- Paste the distribution (max, median, flagged before/after) beside the controls the reviewer measured: free-db
  instructions max 0.05, median 0.00; current own-* legacy text max 0.19 (own-cossack-squat), median 0.08.

## Review aids (in the report)

- **Dump:** one entry per pattern with a common entry (27), plus these 22 staples, overlaps removed, in full:
  `Barbell_Bench_Press_-_Medium_Grip` `Barbell_Squat` `Barbell_Deadlift` `Pullups` `Bent_Over_Barbell_Row`
  `Standing_Military_Press` `Romanian_Deadlift` `Barbell_Hip_Thrust` `Wide-Grip_Lat_Pulldown` `Leg_Press`
  `Dumbbell_Bench_Press` `Incline_Dumbbell_Press` `Dumbbell_Shoulder_Press` `Dumbbell_Bicep_Curl` `Triceps_Pushdown`
  `Side_Lateral_Raise` `Seated_Leg_Curl` `Leg_Extensions` `Plank` `Pushups` `Dumbbell_Lunges` `Face_Pull`.
- **Full file:** a script writes all 178 entries, grouped by pattern then family, to one reviewable markdown file
  (committed under `reports/`).
- **Near-duplicates:** pairs within a family whose `steps` token Jaccard is > 0.85, listed.
- **Muscle mismatch (informational):** tree labels/aliases named in a `description` that aren't among the entry's
  tagged muscles.

## Acceptance criteria (written before implementation)

- Every common entry has all four fields; all validators green, each with a failing fixture.
- Provenance sha test green; `grep -ci repdb src/library/exercises.json` → 0.
- Originality receipt pasted: flagged after rewrite = 0 on both measures.
- **L-026:** main chunk before/after, baseline **340.97 kB**, unchanged beyond noise. A grep of one new sentence in the main
  chunk → 0. Library chunk before/after.
- The review aids above are in the report.
- Existing tests are unedited, except `OWN_FIELDS`/`NEW_FIELDS` list assertions if any (called out). `./check` green;
  paste the line.

## Decisions made on Emilio's behalf

- confirmed 2026-09-24: our own text, better than the source, never RepDB's (DEC-060 §3, DEC-062 §4).
- **(unconfirmed)**: the four fields and their caps; the name `formCues`; no counts or numbers (the timer logs holds);
  breathing cues in steps only; no hype or medical words; own-* legacy text left alone unless it fails originality;
  non-common entries left for later.
- implementation: file format, batching, validator shape, the scripts — builder's call.
