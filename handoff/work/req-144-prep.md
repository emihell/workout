# req-144 prep — model audit, prior art, draft parameter table

Research for the creation design (req-144), 2026-09-24, by a planning research agent. Claims carry file:line or a
source link; the parameter table is a **draft** for Emilio to react to.


Prepared 2026-09-24 for the session 1 of req-144. Code read on `planning` (src/ = main). Three parts:
A current model audit, B prior art, C a draft parameter table. The `[measured]` lines come from
`scratchpad/prep144/probe.mjs` (run with `node`), which calls the real `parseRoutineItem` and
`recommendNextPrescription`.

---

## A. Current model audit

### A1. What each record holds today (schema v9, `model.js:5`, key `workout-mvp-v9` `storage.js:6`)

**Exercise** (`exercise-names.js:69-84`, `model.js:276-283`):
`id, name, equipment, weightStep, muscles, cues, type, hasDuration, durationSec, libraryId?, archivedAt`.
- `type` ∈ `machine | free | bodyweight | cardio` (`ids.js:51`). Only `bodyweight` and `cardio` count as
  unloaded (`ids.js:58-60`). A logged set's weight is forced to 0 for them (`views/workout/item.jsx:241`),
  so **weighted bodyweight moves (weighted pull-up/dip) can't record added load** unless typed as `free`.
- `weightStep`: one increment in kg, `'Alt 4/5'` (alternating machine stack), or `'n/a'` (`weight-step.js:6-7`).
  `progress.js:5` also reads an `exercise.weightOptions` list (e.g. a real plate/stack list), but nothing
  writes it (grep: only `progress.js:5-6`).
- `hasDuration` + `durationSec` (default 30, `model.js:10`): a Timed flag set **on the exercise**, not on the
  routine item (`Routine.jsx:396-400`).
- No unilateral/per-side flag, no "assisted" flag, no difficulty, no alternates/progressions.

**Routine** (`store.jsx:32-41`): `id, name, focus, exercises[], archivedAt`. `focus` is one of
`Machines, Free weights, Bodyweight, Cardio, Mobility, Mixed` (`ids.js:19-26`) and defaults to `Machines`
(`Routine.jsx:91`, `store.jsx:36`). It is a label only. Nothing reads it for behaviour.

**Routine item** (`store.jsx:49-66`, `model.js:47-60`), one per exercise in the routine:
| field | meaning | notes |
|---|---|---|
| `id` | `si-…` | |
| `exerciseId` | → exercise | the same exercise may appear twice |
| `role` | `warmup` ("WU routine") \| `main` \| `finisher` \| `cardio` (`ids.js:62-67`) | Default `main`, or `warmup` for a cardio exercise (`Routine.jsx:423`). Legacy inference: cardio at index 0 → warmup, notes containing "finisher" → finisher (`model.js:12-18`). In the workout it's a label only (`ids.js:79-81`). |
| `warmup` | `null` or `{ reps }` | **exactly one** warm-up set, reps only, **no warm-up weight** (`Routine.jsx:351`, `workout-log.js:698`) |
| `sets` | integer ≥1 | number of working sets |
| `targets[]` | per-set **reps as strings** | free text is kept: `"8-12"`, `"AMRAP"`, `"30s"` (`routine-item-parse.js:10`) |
| `suggestedWeights[]` | per-set kg | `/`-separated; `,` is a decimal point (DEC-058 §1) |
| `durations[]` | per-set target seconds | only if the exercise is Timed (`Routine.jsx:385`) |
| `restSec` | one rest value for the whole item | the same rest after every set, warm-up included (`item.jsx:205-206`) |
| `notes` | free text | |

So per-set targets exist for reps, kg and seconds. They are parallel arrays and are entered as
slash-strings in four separate fields (Sets / Reps / Kg / Duration). `parseRoutineItem` repeats a
shorter list to `sets` and rejects a longer one (`routine-item-parse.js:11-13, 94-104`).

**Schedule** (`schedule.js:56-62`, `model.js:285-296`): `{ loopWeeks: 1..4, anchor: 'YYYY-MM-DD' (a Monday), slots[] }`,
slot = `{ id, week (0-based), weekday (0=Sun), routineId }`. Week index = weeks since the anchor, mod loopWeeks
(`schedule.js:44-50`). Loop length is clamped to 4 (`schedule.js:1-4`, `ids.js:17`). README: a slot "never owns
kg or reps" (README:9).
- **Editing a routine from a schedule slot edits the shared routine** (`Schedule.jsx:199-227` reuses
  `RoutineScreens` on `routine.id`). So "week 2 is heavier" needs a second routine.
- `remainingInLoop` (`schedule.js:134`) gives "what's left in this loop" — the natural hook for the
  DEC-056 end-of-loop review. Nothing marks a loop as finished today.

**Workout** (snapshot at Start, `model.js:444-502`): each plan item copies the routine item plus
`exerciseName, equipment, exerciseType, weightStep, hasDuration`, and `calibrationRequired` (weighted with no
kg > 0, `model.js:474`). The reason text: "From the routine." or "No history yet. Find a starting load."
(`model.js:475-477`). **Logged set:** `routineItemId, exerciseId, setType ('wu'|'work'), weight, reps,
durationSec?, rpe, note, targetReps, targetWeight` (`item.jsx:236-248`). Skipped = `reps:'skipped'`
(`item.jsx:262-277`). Extra sets are counted as `addedSets` on the snapshot item (`workout-log.js:26-65`).
A mid-workout replacement is its own item (req-109).

**Effort ("rpe")** is logged per work set on a 4-step scale, stored as 2/3/4/5 = Easy/Moderate/Hard/Failure
(`ids.js:28-33`). It is **required** on a non-cardio work set (`item.jsx:210-213`). It's not the 1–10 RPE,
and there's no *target* RPE/RIR on a routine item.

### A2. Progression today (`progress.js`)

`recommendNextPrescription` (`progress.js:74-149`) works per set by position (req-112):
- Weighted: missed target reps **or** Failure → one valid step down. **Easy** and not missed → one valid step
  up. Anything else holds (`progress.js:116-132`). So **Moderate and Hard hold**.
- Bodyweight: missed or Failure → target reps −1 (floor 1). Easy → +1 rep (`progress.js:102-113`).
- A step comes only from `validWeights` (`weightOptions` → `Alt 4/5` → `weightStep`). With no step the load holds
  and is never invented (DEC-030, `progress.js:33-36, 91`).
- A time target (`min`, `sec`, trailing `s`) or `AMRAP` is not counted as a rep target (`progress.js:46-64`).
- **Since DEC-056, the result is stored on the finished workout and never written onto the routine.** The
  one writer is History recalc → Apply (`model.js:431-442`). Prefill in the gym comes from history
  (`storage.js:501-511`).

[measured] `node scratchpad/prep144/probe.mjs`:
```
A {"sets":3,"targets":["8-12","8-12","8-12"],"suggestedWeights":[40,40,40],...}      ← a range is stored as text
D range 8-12, did 12 Moderate → "keep"
E range 8-12, did 12 Easy     → weights [42.5] "up"
I range 8-12, did 5 Hard      → "keep"          ← "8-12" parses to NaN, so a range can never be "missed"
G AMRAP did 3 Easy            → [62.5] "up"      ← AMRAP: effort only, reps ignored
H machine (assisted?) 30kg, target 8, did 6 → [25] "down"  ← for an assisted machine this makes it HARDER
```
So a range is progressed by effort only, never by reps (no "hit the top of the range → add weight"
double progression). Assisted load goes the wrong way.

### A3. The old program layer (remnants)

Until commit `e2fb330` (2026-08-30, "drop leftover program and goal code") the model was
`programs[] → { id, name, goal, sessions[] }`. `goal` ∈ `lean | gain | power`, and each goal had a %-jump
and default targets (`git show e2fb330^:src/progress.js:1-23`): lean 2.5 % `12/12/10`, gain 5 % `12/10/8`,
power 7.5 % `8/6/5`. What's left:
- `model.js:65-73`: `flattenRoutines` flattens `programs[].sessions[]` into `routines` when there are none.
- `model.js:75-82, 178, 226-227`: `programLabelFrom` → a legacy rebuilt snapshot keeps `programId/programName`.
- `model.js:313-314`: `delete interim.programs` (and `sessions`).
- `storage.js:259, 266-267`: history grouping keys on `snapshot.programName`.
- `exchange.js:154, 216-227, 248, 258-261`: import validates `programs[].sessions[]`, and a `programs` key
  marks the payload as legacy.
- `plannedWorkouts` is migrated (`model.js:297-309`) but never written (BACKLOG:373).
The live model has no program: only routines plus a 1–4 week loop.

### A4. What the model cannot represent today

| concept | today | evidence |
|---|---|---|
| Supersets / circuits | **No.** Items are a flat ordered list and there's no group field. Rest is per item. The workout goes one item at a time. | `model.js:47-60`; grep `superset|circuit|group` in model/workout-log/overview → none |
| Tempo | **No field.** Only as notes text. | `model.js:47-60` |
| RPE / RIR target | **No.** Effort is *logged* (4-step), never *prescribed*. | `ids.js:28-33`, `item.jsx:210` |
| % of 1RM | **No.** There's no 1RM (estimated or entered) and no % field. The old goal %s were about load jumps, not %1RM. | `progress.js`; `e2fb330^` |
| Rep ranges (8–12) | **Stored as text; progression ignores the range.** "8-12" is kept as-is, but `parseReps` gives NaN, so there's no missed check and no top-of-range rule. | `routine-item-parse.js:10`, `progress.js:41-44`; probe D/E/I |
| AMRAP | **Stored as text, logged as reps, not rep-judged.** Only effort moves it. | `progress.js:51-53`; probe G |
| Drop sets | **No.** Set type is `wu` or work only, so a drop is logged as an extra set. | `item.jsx:231`, `workout-log.js:698` |
| Deload weeks | **No.** No week-level modifier. You'd need a separate routine in a loop slot. | `schedule.js`, `Schedule.jsx:199-227` |
| Multi-week progression | **No.** Progression is session-to-session and is only applied on a manual recalc. No week-by-week plan. Loop ≤4 weeks. | `schedule.js:1-4`, DEC-056 |
| Per-week variation | **Only with separate routines per week.** A slot edits the shared routine. | `Schedule.jsx:199-227`, README:9 |
| Unilateral per-side logging | **No.** One reps/weight per set, no side. | `item.jsx:236-248` |
| Assisted load (higher = easier) | **No, and it's inverted.** "missed" → lower weight = harder. | `progress.js:116-119`; probe H |
| Warm-up ramp (several WU sets, WU weight) | **No.** At most one WU set, reps only. | `Routine.jsx:351`, `workout-log.js:698` |
| Per-set rest / rest after WU | **No.** One `restSec` per item. | `item.jsx:205-206` |
| Weighted bodyweight | **No** (weight forced to 0 for `bodyweight`). | `item.jsx:241` |
| Real plate/stack list | Read (`weightOptions`) but **never written or editable**. | `progress.js:5` |
| Timed per routine (not per exercise) | **No.** Timed lives on the exercise. | `Routine.jsx:396-400` |

What it *does* hold: per-set reps/kg/seconds, one WU set, per-item rest and notes, a role label, a 1–4 week
loop of routines, and effort-based ± one-step progression that is never auto-applied.

### A5. How a routine is created today (UI walk-through, from code)

Routes: `Routines` → `Add routine` (`Routine.jsx:53`) → **RoutineNewForm**: Name (text), Focus (select,
default Machines) → **Next** (`Routine.jsx:89-113`) → **RoutineDetail** (`Routine.jsx:134-216`) →
**Add exercise** (`:156`) → **RoutineExercisePick**: Search field plus a list of your own exercises, or
"Create exercise" (`:257-298`). Tapping a row goes to **RoutineExerciseNew**, one exercise at a time with no
multi-select (`:289`), and shows **ExerciseFields** (`:311-414`):
Role (select) · WU set (checkbox, then Warmup reps) · Sets · Reps (slash-string) · Kg (slash-string) ·
Duration (only if Timed, otherwise a "Not timed…" hint) · "Edit exercise settings" link · Rest (s) · Notes
(5-row textarea) · Cancel / **Save** → back to RoutineDetail. Fields are **prefilled from that exercise's last
finished workout** when there is one (`historyPrescription`, `storage.js:513-534`, `Routine.jsx:421-428`),
otherwise blank. Everything is optional: blank Sets → 1 set (`routine-item-parse.js:85-86`).
Reordering is one Up/Down tap per position (`Routine.jsx:168-176`).

If the exercise isn't in your list yet: Pick → **Create exercise** → hub "Add manually | Search"
(`Exercises.jsx:136-147`) → Search the library (loads the catalog, tap **Add**) or Manual (Name, Type, Save;
duplicate-name check) → lands on that exercise's routine-item form (`Exercises.jsx:117-125`).

**Tap count, a 4-exercise routine** [inferred from the code paths above, not run in a browser]:
- Routine shell: Routines tab 1 + Add routine 1 + Name (focus + type) 1 + Next 1 = **4 taps + typing**.
- Per exercise already in your list: Add exercise 1 + pick row 1 (+ search typing if the list is long) + Save 1
  = **3 taps** with defaults. Filling Sets/Reps/Kg/Rest adds 4 field focuses + typing = **7 taps**.
- Per exercise from the library: add Create exercise 1 + Search 1 + type + Add 1 = **+3 taps** (6 bare, 10 filled).
- **Totals:** all existing, bare: 4 + 4×3 = **16 taps**. All existing, filled: 4 + 4×7 = **32 taps + 16 typed
  values**. All from the library, filled: 4 + 4×10 = **44 taps**. Plus reordering, and then scheduling: Schedule
  tab → day → Add routine → tap routine = **4 taps per weekday**.
- Screens the user sees per exercise: 2 (picker + form), or 4–5 via the library. A first-timer sees **7
  controls per exercise** (Role, WU set, Sets, Reps, Kg, Rest, Notes) plus the Timed hint and link. Two of those,
  Role and Kg for a never-done lift, ask a question a beginner can't answer.
- Known friction already logged (BACKLOG:378-379): four parallel slash-strings instead of a per-set grid,
  catalog search not in the picker, no multi-select, required Focus, one tap per reorder step, per-item rest.
- First-run: Today shows "No data. Import, or start empty." with plain links (`Today.jsx:311-340`). No
  template, goal or guided start. `db.json` is a seed that is never loaded (README:31).


---

## B. Prior art (Strong, Hevy, JEFIT, Fitbod, Boostcamp)

Researched 2026-09-24. Apps covered: Strong, Hevy, JEFIT, Fitbod, plus Boostcamp.

### B · Sources and how far to trust them

- **Vendor help centres and feature pages** (help.strongapp.io, hevyapp.com, jefit.com,
  fitbod.me, boostcamp.app) for flows and fields. Some help pages returned 403 (Hevy
  help centre, Fitbod help centre, JEFIT support) and are cited only from search-result
  snippets. Those are marked *[snippet]*.
- **US App Store reviews**, pulled from Apple's public review RSS feed. There were about
  1,000 reviews per app (10 pages, sorted by mostHelpful, plus mostRecent for Hevy), and
  I filtered them with a regex for creation terms. The feed URL pattern is
  `https://itunes.apple.com/us/rss/customerreviews/page=N/id=<APPID>/sortBy=mostHelpful/json`.
  Reviews there have no permalinks, so each quote cites the app's App Store page and
  the review id from the feed. App IDs: Strong 464254577, Hevy 1458862350,
  JEFIT 449810000, Fitbod 1041517543, Boostcamp 1529354455.
  - Strong: https://apps.apple.com/us/app/id464254577
  - Hevy: https://apps.apple.com/us/app/id1458862350
  - JEFIT: https://apps.apple.com/us/app/id449810000
  - Fitbod: https://apps.apple.com/us/app/id1041517543
  - Boostcamp: https://apps.apple.com/us/app/id1529354455
- **Reddit: not verified.** WebFetch refuses reddit.com, and `site:reddit.com` searches
  returned no threads. This file has **no Reddit quotes**. Any Reddit claim that shows up
  second-hand (for example in vendor comparison pages) is marked *[unverified]*.
- **Sampling caveat:** the mostHelpful sort in the feed leans positive for Hevy. I found
  very few low-star Hevy reviews about creation, so Hevy's complaint evidence is thinner
  than the other apps'.

---

### B1. Strong: a template-first logger

**Creation flow**
- Start Workout tab → **"+ Template"**, or `...` next to a folder → create a template
  inside that folder. You then "add exercises and sets to the template in the **same way
  as you would for a workout**". Save puts it in the Library.
  https://help.strongapp.io/article/105-about-routines
- You can also create a template **from a finished workout**: History → `...` →
  "+ Save as Template". The app also offers to do this when you finish a workout
  (same URL).
- Templates are workouts that can't be run: "Sets cannot be completed", "There's no
  completion time or date for a template", and the rest timer is unavailable while
  editing (same URL).
- **Custom exercise:** Exercises tab → *New* (iOS), or `...` → *Create Exercise*
  (Android). You can also do this mid-workout.
  https://help.strongapp.io/article/97-create-custom-exercises
  - Fields are name, body part and category (barbell, dumbbell, machine, bodyweight,
    duration and so on). *[inferred from app knowledge; the help page does not list
    them]*
  - The library has "over 200 built in exercises".

**Default vs behind options**
- Default: sets × weight × reps, a rest timer and notes.
- Behind the set/exercise menus:
  - Set tags: Warm Up / Failure / Drop.
  - Supersets: `...` → *Create Superset* → pick exercises → chain icon.
    https://help.strongapp.io/article/98-supersets-and-circuits
- RPE is on the keyboard: select the Reps cell, then "hit the RPE button in the
  keyboard". https://help.strongapp.io/article/230-about-rpe
- Rep ranges and target RPE in templates: not documented. *[unverified]*

**Beginners:** built-in example templates, and nothing else. There is no questionnaire.
The free tier is limited to **3 templates** ("You can create up to 3 Workout Templates
with the free version"). A third-party review: "No programmes, AI or coaching".
https://aitoolsbakery.com/blog/strong-app-review/

**Multi-week:** none. There are templates in folders, and the user rotates them by hand.

**Review evidence**

Praise:
- "Creating routines is easy and the ability to add custom exercises is a huge plus… I
  shouldn't have to create half of the exercises I'm doing." *(4★, id 3773254240)*
- "When you enter the weight and reps for the first set it automatically fills the
  remaining sets with those same values… You can add exercises and rearrange… mid
  workout and then optionally save those changes to the associated template." The same
  reviewer's gripe: "confusing options about how or if to update the template" when
  finishing a workout. *(5★, id 13555349902)*
- "Simple; clean; easy to set up exercises, sets, reps, and supersets."
  *(5★, id 3828865901)*
- "Unlike many others that want you to change your routine to the expert advice from
  the app, Strong allows you to make your own routines and custom exercises."
  *(5★, id 4124989933)*

Complaints:
- "Configuring your workout inside the app is super tedious… hoped that there would be
  a csv import for my own routines… Have to do it all by hand." *(4★, id 7484710914)*
- "I wasted a lot of time creating my templates only to be informed that I either had
  to use one of their premade templates or pay." The 3-template cap counts the
  examples. *(2★, id 7709097502)*
- "Arms should be broken down into biceps and triceps… Trying to create a hamstring
  focused workout is kind of a pain." The muscle filter is too coarse.
  *(4★, id 3773254240)*
- "I also selected the wrong category for an exercise I made and there was no way to
  change or delete that." This is an old version (4.22), so it may be fixed.
  *(2★, id 1822640222)*
- A regression note from the v6: "When adding an exercise to a template, the app will
  use the same weights & reps as the last time… If I modified a weight… it used to roll
  that change down to all the subsequent sets." *(3★, id 12846879961)*

---

### B2. Hevy: a routine-first logger with a folder model

**Creation flow**
- Workout tab → **New Routine** → name it (e.g. "Push") → **+ Add exercise**.
  https://www.hevyapp.com/features/gym-routines/
- The picker has **search, equipment and muscle filters, and multi-select**: "add
  multiple together or one at a time". *[snippet, help.hevyapp.com article 34953606698903]*
- For each set you enter KG/LBS and REPS, or TIME for duration exercises.
  - **Rep range:** tap the REPS header to switch to a range such as 8–12.
    https://www.hevyapp.com/features/how-to-write-sets-and-reps/
  - "When adding a previously completed exercise, the number of sets, the weight, and
    the reps you've done before are automatically added" (same URL).
- Folders: routines can be dragged between folders, and "You can add unlimited new
  routines to the folder". https://www.hevyapp.com/features/gym-routines/
- **Custom exercise** fields: name, equipment, primary muscle, multiple secondary
  muscles, exercise type (weight & reps, duration and so on), and an optional image.
  The free tier allows **7 custom exercises**. *[snippet, help.hevyapp.com article
  35700328894103; https://www.hevyapp.com/features/custom-exercises/]*

**Default vs behind options**
https://www.hevyapp.com/features/exercise-programming-options/
- Visible by default: weight, reps, a note field per exercise and a rest timer per
  exercise.
- Routine notes persist every time the routine is reused. Workout notes belong to one
  session.
- Tap a set to choose its type: Warm Up / Normal / Failure / Drop.
- Supersets: `...` → "+ Add To Superset".
- **RPE is off by default.** Turn it on in Profile → Settings → Workouts →
  RPE Tracking. You log it only during live workouts, not as a target in routines.
- The default rest timer is set globally in Settings.

**Beginners**
- An Explore library of **26 programs**, 8 of them beginner, with Level / Goal /
  Equipment filters.
  https://www.hevyapp.com/features/gym-workout-routines/
- A program saves into your library as editable routines.
- There is a ChatGPT/HevyGPT routine generator. There is no onboarding questionnaire
  that builds a plan.
- Free tier: 4 routines, according to reviews. Earlier limits vary by date.

**Multi-week:** none. A "program" is a folder of routines. Boostcamp's comparison
(vendor-authored, so biased) says: "Hevy's routines are single training sessions or
short cycles rather than multi-block periodized programs; progression across blocks is
the lifter's responsibility", and HevyGPT "typically produces a single routine".
https://www.boostcamp.app/vs/hevy

**Review evidence**

Praise:
- "I feel like I have been able to easily create workout routines in a couple of
  minutes." *(5★, id 14098742317)*
- "Hevy does all you need and nothing you don't. If you want an app that will program
  for you… this isn't it… If you want to build you own workouts… THIS IS THE APP… other
  apps… try to be everything to everyone which usually makes them clunky."
  *(5★, id 13015405579)*
- "Making your own programs is extremely intuitive and has everything from warm up sets
  to drop sets." *(5★, id 12041167295)*
- "i can make my routines on the website from a pc which is quicker than doing so on my
  phone." *(5★, id 12431173644)*
- "I use the routines in the explore tab as a jumping off point all the time"
  (explore is "fairly limited"). *(4★, id 10733454872)*
- "I don't know how this app would be for a complete beginner because I came into it
  already knowing a lot." *(5★, id 12769249527)*

Complaints (these are few in the sample):
- "A way to set up more generalized templates… automatically cycle through variations…
  coupled with a way to set up a custom progression would definitely get me to buy."
  *(4★, id 11770839401)*
- A DUP (daily undulating periodization) user wants hypertrophy and strength sets
  tracked separately, and works around it with duplicate custom exercises.
  *(4★, id 14574853416)*
- "The next set starts with the weight reset to 0 instead of carrying forward… or at
  least retain the planned weight from the routine." This is on the watch.
  *(4★, id 14215217579)*

---

### B3. JEFIT: plan-first, with a heavy library and heavy UI

**Creation flow**
https://www.jefit.com/wp/product-tips-faq/how-to-create-custom-workout-plans/
- Workout tab → "create my own workout plan" → set **days per week, goal, difficulty
  level**. The plan becomes the active plan automatically.
- You then edit each day: "change the name, day of the week, copy, or delete".
- To add exercises: open a day → *add exercise* → browse the library → "select" to add
  several at once (multi-select) → "add to workout".
- Then "adjust the number of sets, reps, the rest period, and the intervals".

**Newer Routine Builder** (web, full-screen)
https://www.jefit.com/blog/introducing-new-routine-builder-workout-planning-simplified
- "Manage your entire routine from a single screen — no more switching tabs." Days
  are reached by scrolling or a day picker.
- Weight, reps and rest/interval per set, plus Warm-up / Drop / Failure set types.
- Share by link.
- There is also a web builder you can download to the phone:
  https://www.jefit.com/build-routine
- The library has 1,500+ exercises and ready plans (5x5, PPL, full-body).

**Beginners:** onboarding is a long mandatory questionnaire. One reviewer: "forces you to
answer a long series of questions with no option to skip, even if all you want is a
simple workout log." *(1★, id 13565130799)* There is also a large public routine
database: https://www.jefit.com/routines

**Multi-week:** a plan is a cycle of days, and a reviewer reports a ceiling: "I would like
to request for the workout plans to go beyond 31 days for 8,10,12 week programs."
*(5★, id 8185770018)* There are no per-week variations. *[inferred from docs; not
verified in app]*

**Review evidence**
- "Jefit seems to be getting more aggressive about insisting we build workout plans…
  cluttered noise of workout timers, adding to workout plans… more clicks needed just to
  track sets and reps." *(3★, id 10453879394)*
- "It makes me create a workout routine which I find annoying because my workouts change
  on a daily if not weekly basis." *(2★, id 8513106580)*
- "Removed ability to change number of sets… I'm now forced to recreate my entire
  routine… extremely tedious." *(2★, id 12578887398)*
- "The second i added that [HIIT plan] BOOM my whole daily workout program got deleted."
  Adding a plan replaced the user's own plan. *(3★, id 3818264973)*
- "No circuit feature. Currently you have to superset and duplicate exercises in
  sequential order to mimic a circuit." *(4★, id 13557231589)*
- "May feel clunky at times in the ways that it has you create custom exercises… The
  flexibility it allows in designing plans… is top-notch." *(5★, id 9867249084)*
- Praise: "I built my workout week and got started… It's all on one page, in full view…
  There's 0 friction." *(5★, id 7251438599)*
- "Too complicated, too many useless features… This used to be a straight forward app
  that let you create your workouts and track them." *(1★, id 13377986083)*

---

### B4. Fitbod: the algorithm creates, the user edits

**Onboarding:** a questionnaire covering:
- goal (six options: General Fitness, Strength, Muscle Tone, Bodybuilding, Powerlifting,
  Olympic)
- experience (beginner / intermediate / advanced)
- equipment ("gym profiles")
- split (full / upper-lower / PPL)
- duration
- toggles for cardio, warm-up and supersets.

Each goal changes rep and rest style ("higher reps, and shorter rest periods" for Muscle
Tone, "higher weights, fewer reps" for Powerlifting).
https://fitbod.me/blog/fitbods-fitness-goals/ and
https://fitbod.me/blog/how-fitbod-builds-personalized-strength-programs-without-a-trainers/

**Creation:** each session is generated from recovery, history and settings. For manual
creation:
- Workout tab → Swap → **"Create Workout From Scratch"** → +Add Exercise at the bottom,
  swipe to Replace/Delete. *[snippet, help.fitbod.me 360006335593]*
- **Saved Workouts**: `...` → Save Workout.
- Loading a saved workout offers three modes: exact as saved, "keep your saved set and
  rep scheme, and let Fitbod update weights", or regenerate sets/reps/weights. Per the
  blog, the per-load choice was **Android-only** at the time of writing.
  https://fitbod.me/blog/saved-workouts/
- Custom exercises exist and "behave like any other exercise". *[snippet,
  help.fitbod.me 28062570249623]*

**Multi-week:** there is no user-built multi-week program. The algorithm is the program.

**Review evidence**
- "The app tries to present a randomized workout every day, even when specific workouts
  have already been defined… multiple clicks to start a saved routine every workout.
  Cumbersome… Rep counts also affect future sets, so if you push to failure… all future
  workouts now have one less rep." *(3★, id 8879806482)* This is the app changing
  prescriptions from one logged set.
- "I rarely depend on the app's recommendations. So i spend usually around 30 mins to
  prep my session the day before… adding exercise is possible only at the top… you need
  to bundle and unbundle the supersets countlessly." *(5★, id 3921063117)*
- "The real problem comes in making your own workouts… Supersets and giant sets are
  difficult to create on your own. Drop sets confuse the app." *(2★, id 4836483653)*
- "I can't edit a saved workout to create a new superset; I can only do that while I'm
  actively in a workout… they keep moving where the saved workouts are."
  *(1★, id 13094180689)*
- "Do you want to add an exercise? Okay, but sit down for awhile… if you already have
  some idea on what you want to do in the gym… look elsewhere." *(3★, id 2993564213)*
- "When I tried to narrow down the exercises I wanted to include there were like a
  thousand options… I'd rather record my own workout from a small selection of simple
  and common weightlifting moves." *(3★, id 8991124609)*
- "Would be nice if i could take any exercise and save as favorite reps and sets… save
  any superset i create as a favorite." *(5★, id 11098130659)*
- Beginner praise: "It took the overwhelming planning [off] me." *(5★, id 7029913594)*
  Another: "You tell it all about yourself… and it spits you out a weekly program."
  *(5★, id 12427454695)*
- Expert critique of the generator: it "generated a chest and tricep routine that
  started with 6 sets of 2 reps with dumbbell flys." *(2★, a personal trainer,
  id 4067764303)*

---

### B5. Boostcamp: program-first

- Its core offer is following published programs (GZCLP, 5/3/1, nSuns and others) laid
  out week by week.
- It also has a **Custom Program Builder**, a desktop, spreadsheet-style creator. It
  supports "multi-week periodization, exercise swaps, and custom progressions", organises
  a program by weeks and days, and lets you "duplicate days and weeks". Shortcuts include
  double-click to edit, Shift+Enter to add a set and drag to reorder. It syncs to mobile.
  https://www.boostcamp.app/program-creator ,
  https://insider.fitt.co/press-release/boostcamp-launches-web-program-creator-the-easiest-way-to-make-free-workout-plans/
- Beginner praise: "I don't know what to do in my own and how to structure workouts with
  weeks… This app takes care of that with its built in programs." *(5★, id 13228661541)*
  Another: "breaks them down for you… very easy to digest weekly schedule."
  *(5★, id 9168761732)*
- Multi-week editing pain:
  - "I try to duplicate it to the rest of the days after editing it but it does not
    duplicate… I have to go and manually change every single day for my 16 week
    program." *(3★, id 12865569020)*
  - "I can't write up the program in the first week to be 4x8 to a 3x3 on the fourth
    week it just keeps the entire 4 week program to whatever." This describes an older
    builder. *(5★, id 10532504107)*
  - "modifying or editing programs is clunky and unresponsive" on the web UI.
    *(2★, id 12255099896)*
- Per-program state gap: "my target weights week to week do not update… rely on memory
  or fiddle around with the history tab." *(2★, id 11272034324)*

---

### B · Comparison at a glance

| | Strong | Hevy | JEFIT | Fitbod | Boostcamp |
|---|---|---|---|---|---|
| Unit of creation | template | routine (+folder) | plan → days | generated session / saved workout | program → weeks → days |
| Picker multi-select | *[unverified]* | yes, with equipment and muscle filters | yes ("select") | one at a time, +Add at bottom | yes |
| Rep range target | *[unverified]* | yes (tap REPS) | *[unverified]* | no (algorithm sets it) | yes |
| RPE | keyboard button when logging | off by default; logging only | *[unverified]* | no | in programs |
| Set types | Warm/Fail/Drop tag | Warm/Normal/Fail/Drop | Warm/Drop/Fail | no (drop sets "confuse the app") | yes |
| Save from finished workout | yes | yes | *[unverified]* | yes (manual) | n/a |
| Beginner entry | example templates | Explore, 26 programs, filters | questionnaire + plan library | questionnaire → auto plan | program catalog |
| Multi-week | no | no | day cycle, ≤31 days (per review) | implicit (algorithm) | yes, weeks and duplication |
| Free cap | 3 templates | 4 routines, 7 custom exercises | ads + premium gating | paywall after trial | customization gated |

---

### B · Patterns that make creation work well

1. **Build the routine with the same screen you log with.** Strong adds template
   exercises "in the same way as you would for a workout", so there is one interaction
   to learn. Reviews call creation "easy" and "simple; clean" (Strong ids 3773254240,
   3828865901).
2. **Save a finished workout as a routine.** Strong ("+ Save as Template", also offered
   when you finish), Hevy and Fitbod all do it. Creation becomes a by-product of
   logging, which is where beginners start.
3. **Prefill a new routine from your own history.** Hevy adds "the number of sets, the
   weight, and the reps you've done before", and Strong users liked the roll-down fill.
   Losing roll-down drew a complaint (Strong id 12846879961). The value comes from
   history, not from invention.
4. **Keep the default row minimal and put advanced options one tap away.** Hevy shows
   weight × reps and notes. Set type sits behind a tap on the set, supersets behind
   `...`, RPE behind a Settings toggle. Users praise it for "nothing you don't [need]"
   and for being not "clunky" (Hevy id 13015405579).
5. **A multi-select picker with equipment and muscle filters.** Hevy and JEFIT have one.
   Coarse filters get called "kind of a pain" (Strong, hamstrings under "legs", id
   3773254240), and an unfiltered 1,000-item list is overwhelming (Fitbod id 8991124609).
6. **Library as a starting point, then fully editable.** Hevy's Explore is filterable by
   Level, Goal and Equipment and saves as normal routines: "a jumping off point"
   (Hevy id 10733454872). Boostcamp's catalog serves beginners who "don't know… how to
   structure workouts with weeks" (id 13228661541).
7. **Persistent per-exercise notes inside the routine** for machine settings and form
   cues. This gets unprompted praise (Strong id 5188665827, id 7200052369) and Hevy
   separates routine notes from workout notes.
8. **Edit mid-workout, then choose whether to write the change back to the routine.**
   Praised in Strong (id 13555349902) and Hevy (id 12351281597), but the write-back
   prompt must be clear (see anti-pattern 8).
9. **For multi-week plans, duplicate weeks and days and allow per-week variation.**
   Boostcamp's builder does this, and its absence is the top complaint: "manually change
   every single day for my 16 week program" (id 12865569020), and not being able to go
   "4x8 to a 3x3 on the fourth week" (id 10532504107).
10. **A bigger screen for bulk authoring.** Hevy web ("quicker than… my phone",
    id 12431173644), the JEFIT web builder and the Boostcamp desktop creator all offer
    one. Phone-only authoring gets called "tedious" (Strong id 7484710914).

### B · Patterns that make creation cumbersome

1. **A mandatory questionnaire before you can log anything.** JEFIT: "no option to skip,
   even if all you want is a simple workout log" (id 13565130799).
2. **Forcing a plan before a log.** JEFIT: "makes me create a workout routine… my
   workouts change" (id 8513106580). Fitbod pushes a generated workout over saved ones:
   "multiple clicks to start a saved routine every workout. Cumbersome" (id 8879806482).
3. **Prescriptions that silently change from one logged set.** Fitbod: "if you push to
   failure… all future workouts now have one less rep" (id 8879806482). The user can't
   see why a number changed.
4. **Structural edits only available in some modes.** Fitbod: "can't edit a saved workout
   to create a new superset; I can only do that while I'm actively in a workout"
   (id 13094180689). Old Strong couldn't reorder or recategorise after saving
   (id 1822640222). JEFIT removed set-count editing (id 12578887398).
5. **A missing grouping primitive, faked by duplication.** JEFIT had no circuits:
   "superset and duplicate exercises in sequential order" (id 13557231589). Fitbod
   supersets "bundle and unbundle… countlessly" (id 3921063117). Drop sets "confuse the
   app" (id 4836483653).
6. **No bulk or duplicate operation for repetitive structure.** Boostcamp 16-week manual
   day edits (id 12865569020). Strong has no import: "Have to do it all by hand"
   (id 7484710914).
7. **Destructive plan switching.** JEFIT: adding a second plan deleted the user's own
   plan (id 3818264973).
8. **An ambiguous "update the template?" prompt when you finish a workout.** Strong:
   "confusing options about how or if to update the template" (id 13555349902).
9. **Creation caps that count seeded examples.** In Strong, the 3-template cap was
   "absorbed by premade templates", so the user "wasted a lot of time creating my
   templates" (id 7709097502). This is a paywall issue, but its UX lesson generalises:
   don't let examples crowd out the user's own work.
10. **Feature creep around the core row.** JEFIT: "cluttered noise of workout timers…
    more clicks needed just to track sets and reps" (id 10453879394). "Too many useless
    features" (id 13377986083). A Strong v6 complaint says the inline timer "cluttered
    the UI" (id 12675348664).

### B · Beginner vs advanced

- **Beginners** get a starting point in one of three ways:
  - pick from a library: Hevy Explore, Boostcamp, JEFIT plans
  - answer a questionnaire: Fitbod, JEFIT
  - log first and save afterwards: Strong, Hevy.

  The generated route is praised for taking "the overwhelming planning" away (Fitbod
  id 7029913594), but experienced users reject its choices (id 4067764303).
- **Advanced** users want:
  - control
  - rep ranges
  - set types
  - supersets and circuits
  - multi-week variation
  - custom progression (Hevy id 11770839401)
  - a big screen.

  They leave generators ("look elsewhere", Fitbod id 2993564213) and praise apps that
  "do all you need and nothing you don't" (Hevy id 13015405579).
- **Multi-week programs** exist only in the program-first app (Boostcamp) and, weakly,
  in JEFIT (≤31-day cycle per a review). Strong and Hevy deliberately stay at
  routines in folders.

---

## C. Draft parameter table — DRAFT, planning's suggestion, for Emilio to react to (nothing here is decided)

Personas (the draft from req-144 Q1): **F** = first-timer with no plan · **Y** = ~1 year in, with a routine
from a friend · **A** = advanced, running a program with % and progression.
Cell values: **must** = shown on the default path · **default** = has a value without asking, editable in one
tap · **hidden** = behind "more"/options, off until asked for · **n/a** = not offered.
A default must follow DESIGN §1: it's a *structure* default (e.g. 3 sets), never an invented *load*.

| # | parameter | what it is | F | Y | A | model today? |
|---|---|---|---|---|---|---|
| 1 | Exercises (pick) | which movements | **must**, from a short staple list or a template, multi-select | **must**: search own + library, multi-select | **must**: search, multi-select | Y, one at a time (`Routine.jsx:257-298`) |
| 2 | Order | sequence in the routine | default (pick order) | default, drag to change | default, drag | Y, Up/Down one step (`Routine.jsx:168-176`) |
| 3 | Routine name | label | default ("Day A"/template name), editable | must | must | Y (`store.jsx:32-41`) |
| 4 | Focus | category label | hidden, or inferred | hidden | hidden | Y, required select, no behaviour (`ids.js:19-26`) |
| 5 | Working sets | count | default 3 | default 3 (or history) | must | Y `sets` (`model.js:54`) |
| 6 | Reps (one target) | reps per set | default (e.g. 10), editable | must | must | Y `targets[]` (`model.js:55`) |
| 7 | Rep range (8–12) | min–max target | hidden (one number is enough) | default? (this is how friends' routines read) | must | **text only**, progression ignores it (probe D/I) |
| 8 | Weight (kg) | load per set | **hidden at creation**: found in the gym (req-10 calibration), then from history | default from history, else blank | must/default from history | Y `suggestedWeights[]`. Blank is allowed and honest (`model.js:474`) |
| 9 | Per-set variation (pyramid 12/10/8, 60/65/70) | different values per set | hidden | hidden (one tap: "vary per set") | must | Y, via slash-strings (`routine-item-parse.js`) |
| 10 | Warm-up sets | ramp before working sets | default off; offered in-gym | default 1 on compounds? | must: several, with weight | **Partial**: one WU set, reps only (`Routine.jsx:351`) |
| 11 | Rest | seconds between sets | default (e.g. 90 s), hidden | default, editable | must, maybe per set | Y, per item only (`model.js:51`) |
| 12 | Notes | free text | hidden | hidden | default visible | Y (`model.js:52`) |
| 13 | Timed / duration | seconds instead of reps | from the exercise (plank), no choice | same | same, per item? | Y, on the exercise only (`model.js:281-282`) |
| 14 | Role (main/finisher/WU routine/cardio) | label | hidden/inferred | hidden | hidden | Y, a label only (`ids.js:62-67`) |
| 15 | Supersets / circuits | grouped items, alternating | n/a | hidden ("pair with next") | must | **N** (A4) |
| 16 | Tempo | e.g. 3-1-1 | n/a | n/a | hidden | **N** (notes only) |
| 17 | Target effort (RPE/RIR) | prescribed intensity | n/a (they *log* Easy/Moderate/Hard) | n/a/hidden | hidden or must, depending on the program | **N**: effort is logged only (`ids.js:28-33`) |
| 18 | % of 1RM | load as % of a max | n/a | n/a | must for % programs | **N**: no 1RM, no % (A4) |
| 19 | AMRAP set | last set to failure | n/a | hidden | hidden | **text only** (probe G) |
| 20 | Drop sets | reduce and continue | n/a | hidden | hidden | **N**: set types are `wu`/work (`item.jsx:231`) |
| 21 | Progression rule | how next time's target moves | default (the app's effort rule), explained | default, visible reason | must (choose: linear, double, %-wave) | **Partial**: one effort rule, ±1 step, not auto-applied (DEC-056, `progress.js:74-149`) |
| 22 | Weight increment | smallest valid jump | default from the library/equipment | default, editable | must | Y `weightStep`/`Alt 4/5`; `weightOptions` never written (`progress.js:5`) |
| 23 | Unilateral (per side) | log L/R | from the exercise, no choice | same | same | **N** |
| 24 | Assisted (higher = easier) | inverted load | from the exercise | same | same | **N**, progression is inverted (probe H) |
| 25 | Weighted bodyweight | added load on pull-up/dip | n/a | hidden | must | **N**: weight forced 0 (`item.jsx:241`) |
| 26 | Schedule: which weekdays | when | default (template's days) / one question "how many days?" | must | must | Y slots (`schedule.js:56-62`) |
| 27 | Loop / rotation (A/B weeks) | repeating cycle | hidden (1 week) | default 1, optional 2 | must, up to N weeks | Y, 1–4 weeks, clamped (`schedule.js:1-4`) |
| 28 | Per-week variation | week 2 differs from week 1 | n/a | n/a | must | **Only via separate routines** (`Schedule.jsx:199-227`) |
| 29 | Deload week | planned lighter week | n/a | hidden/suggested? | must | **N** |
| 30 | Multi-week program (phases, waves) | a plan over weeks with its own progression | n/a | n/a | must (or import) | **N**: program layer removed `e2fb330` |
| 31 | Starter template / goal | where to begin | **must**: pick one, or blank | optional ("copy a routine") | optional (import/known programs) | **N**: no templates; the old goal profiles were removed (A3) |
| 32 | End-of-loop review (DEC-056) | deliberate "update routine" step, with numbers | default: shown, one-tap accept | default | must | **N**: only History recalc, with no numbers (DEC-056 correction) |
| 33 | Alternates / easier-harder version | swap when busy/too hard | hidden, offered in-gym | hidden | hidden | **N** (library Q6); replace-in-workout exists (req-109) |

Draft observations for the session (suggestions, not decisions):
- Rows 5, 6, 11 can take a **structure default** without breaking DESIGN §1 (3 × 10, 90 s is a template choice
  the user sees, not invented history). Row 8 (kg) can't. For F the honest answer is "found in the gym" (req-10).
- The cheapest high-value model gaps look like **rep range as a real range** (7), **multi WU with weight** (10),
  **supersets** (15), and **assisted/unilateral/weighted-BW exercise flags** (23–25). They're item or exercise
  fields, with no program layer.
- Rows 17, 18, 28–30 are the "program" layer. They're the A-only rows, and they're the ones that need the
  program-vs-routine model question (Q5) answered first.

---

## D. Inputs from Emilio, 2026-09-25 (after the prep)

1. **Pin + search the whole library** (in-app note, `/exercises`, 2026-09-24): "pin your favorite exercises, or add if
   there is missing ones - but not add from the library - then when you create a rutine - you can just search the whole
   library - that removes one step". Planner: agree; picking a library entry creates the user's own exercise record
   silently (it holds his settings — weight step, equipment, cues, timed — and is what history links to). **Check first:**
   why search became own-only on 2026-09-24, so that change isn't undone blind.
2. **History independent of the exercise records:** Emilio asked to "stamp" exercises into each workout. Already true
   in part — each finished workout's `snapshot.items[]` keeps `exerciseName, equipment, exerciseType, weightStep`
   [measured on his 2026-09-25 export]. The `exerciseId` link is still needed (last-time prefill, load recommendation).
   **Gaps to decide:** the snapshot doesn't keep `muscles` or `libraryId`; adding them to new workouts only (no rewrite)
   would make a future exercise-database swap a one-time id mapping. Feeds req-146 (server).
3. **Back is a design signal** (in-app note, `/history/:id`): "going back is heavy signal that you made an error -
   unless you want to inspect something - but then that information should be available to you fast". Consider
   surfacing workout detail where it's opened from (Today).

## E. Beginner-persona run, 2026-09-25 (an AI agent as "Sam", phone width, main `63f4554`)

Two runs. Run 1's top finding (a new user sees someone's demo data) was **the harness**: `plan qa` re-injects its seed
whenever storage is empty (`scripts/qa.mjs:66-67`); a real first load is `emptyState()` (`persistence.js:159-161`).
Run 2 used an empty seed (`emptyState()` written to the scratchpad). Findings 3–8 reproduced in **both** runs.
Caveat (the agent's own): it knew the jargon and kept going where a real beginner would stop.

**For the design (Emilio's calls):**
1. **The routine asks for kg, and the workout never uses it.** Sam typed 40 kg into the routine; the first workout's kg
   field was blank, the plan read "1 · — × 10". By rule: prefills come only from history (DEC-082 §2 — the live seed never
   reads `suggestedWeights`). So either the routine shouldn't ask, or it's the one allowed "plan" number. Biggest one.
2. **Blank kg is accepted on Complete** for a weighted exercise — no hint; a beginner would log a whole workout at "—".
3. **Jargon:** "WU set", "WU routine", "Role" (Main/Finisher), "Focus", "Rest (s)", "12/11/10" slash notation, "Loop ·
   1 week", "Failure", "Replace exercise", "Import", "full library", an unlabelled "3200 kg" in History.
4. **Adding an exercise to a routine:** 4 taps before typing (Add exercise → Create exercise → Search → Loading…); ~11 taps
   per exercise, ~55 for a 5-exercise routine. Emilio's pin + search-the-whole-library idea (§D.1) targets this.
5. **Rest is blank by default** → no rest timer unless the beginner fills it in.
6. **" — Machines"** is appended to every routine name from the Focus default Sam never chose.
7. **Finish with an exercise half-done** goes straight to Feel, no warning; the set count includes warm-ups.
8. **No move to the next exercise** after the last set — back to the list each time.
9. **Home order** (future at top, today in the middle, req-60 — Emilio's own choice) read "upside down" to Sam.
10. **Empty Home:** "No data. Import, or start empty." — "start empty" isn't a button; nothing says "make your first routine".

**Bug (binary, DEC-091 §4 — Planner fixes):** the routine screen comes back scrolled down after saving an exercise
(`scrollY` 58.5 after the 4th, 136.5 after the 5th; 0 with ≤3) and the edit screen opens scrolled with its title cut off
— a mis-tap in the run.

**Worked well:** making a routine and schedule is quick once found; logging is one-handed with big fields; the rest timer
starts itself and shows on every screen; Effort words are plain; History detail is accurate.

**From req-175's review (2026-09-25):** a warm-up *exercise* (role) and a warm-up *set* now share the word — History can read
"Warm-up · Warm-up set · 1 set"; the routine editor still says "WU set" (`ids.js:95`, `Routine.jsx:351`) next to role "Warm-up";
the assistant prompt `exchange.js:38` still says "WU routine"; `README.md:8` says "WU set". Decide the two names in req-144.

## F. Slot templates — research, 2026-09-26 (agent, sources fetched)

Emilio: "the template is essentially just a muscle group that we recommend you train - then you add the exercises yourself …
you could choose how many days you want to rotate, then we can give a template where a recommended split is added".

| Days | Split | Slots per day |
|---|---|---|
| 1 | Full body ("minimum") | Squat · Hinge · H-Push · H-Pull · Core |
| 2 | Full body A/B | A: Squat · H-Push · H-Pull · Core — B: Hinge · V-Push · V-Pull · Lunge |
| 3 | Full body A/B/C | A, B as above — C: Squat · H-Push · V-Pull · Core |
| 4 | Upper/Lower ×2 | Upper: H-Push · H-Pull · V-Push · V-Pull — Lower: Squat · Hinge · Lunge · Core |
| 5 | U/L/Full/U/L [inferred, no source] | |
| 6 | Push/Pull/Legs ×2 | Push: H-Push · V-Push · H-Push · Core — Pull: V-Pull · H-Pull · Hinge · Core — Legs: Squat · Hinge · Lunge · Core |

4–5 slots a session. Weekly rule: squat, hinge, push, pull, core ≥1×; from 2 days, each ≥2× and both push/pull planes.
Evidence: ACSM 2009 (PMID 19204579) "2-3 d x wk(-1) for novice"; ACSM 2026 (PMID 41843416) "≥2 sessions/wk", "≥10 sets/wk";
NSCA: novice "two or three days per week when training the entire body", U/L 4× = intermediate, 4–6 = advanced;
Schoenfeld 2016 (27102172) "at least twice a week"; Schoenfeld 2019 (30558493) frequency doesn't matter volume-equated;
split vs full body 2024 (38595233) "based on personal preferences"; Weekend Warrior (PMC11127831) one session supported;
CDC "2 or more days a week". Sources agree beginners = 2–3 full-body days.
Library fit [measured, `src/library/exercises.json`, visible 366]: `common` is true on all 366 (useless as a filter); `staple`
194/172 is the useful flag. Every slot has ≥3 staples overall; thin per equipment: V-Pull barbell/dumbbell 0 (expected),
Lunge machine 0, Hinge bodyweight 1, Carry only 3 exercises. Dips are tagged `vertical-push` (likely wrong).

## G. Sam run on the new flow, 2026-09-26 (main `6c4dc7c`, after req-178..181)

Plan: empty Home → saved 3-day plan **40 taps** (12 slots × 3; 9 are re-picks of A/B in C). Picker: 2 exercises in 4 taps +
2 searches. §E fixed: 1, 4, 5, 6, 7, 10, scroll bug; partly 3 (Loop, Import, full library, slash, Volume remain); open 2, 8, 9.
Findings: (1) auto-finish offer doesn't name the exercise, "Routine: —", under a countdown → **req-182**; (2) skipping the offer
loses the weight — next time kg blank, nothing shows what he lifted (DEC-096 §5 "no last time") → Emilio; (3) blank kg accepted
(Row stored weight 0) → Emilio; (4) no sanity check: mis-typed 500/350 kg saved → Emilio; (5) Home: today unlabelled, dock
"Workout" does nothing with no workout; (6) plan fill shows slot not pick → **req-182**; (7) "Warm-up exercise" unexplained,
"Not timed…" line puzzles; (8) jargon above; (9) no next exercise (DEC-093 keeps it).
