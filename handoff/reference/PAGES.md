# Pages → decisions

The decisions that shape what each page shows or does, so feedback on a page can be checked against them (**DEC-137**).
Live decisions only: a superseded one is left out, and the DEC that replaced it is listed instead. Detail is in
`log/DECISIONS.md`. Values that bind every page are in `rules/DESIGN.md`.

**Whose call:** **E** = Emilio decided or confirmed it. **P** = Planner's or Builder's call (`(unconfirmed)`, under
DEC-095). Library content calls are P too (DEC-067).

**How to use it (DEC-137):** for feedback on a page, look the page up, plus **Every page**.
- If the feedback goes against an **E** line, or against a value in DESIGN.md: stop and bring it to Emilio with what that
  decision was, why it was made, and two or three options. He decides, and that becomes a new DEC.
- If it goes against a **P** line, or against nothing listed: Planner fixes it and reports what changed. When a P line
  changes, the new call gets recorded as its own DEC.
- **Keep it current:** each new DEC that a user would see adds or replaces its line here in the same `./plan save`
  (CLOSEOUT.md, recording pass).

Built 2026-10-26 from DEC-001..136; kept current since (DEC-138).

## Every page

- **E** DEC-096, DEC-002, DEC-022, DEC-030: never invent data. The workout's kg comes from the routine; history prefills
  the routine's kg when an exercise is added; with no valid weight step the recommendation holds.
- **E** DEC-071: design for the first-time gym-goer; nothing added later may disturb the simple routine.
- **E** DEC-010: mobile first; the live workout is mobile-only.
- **E** DEC-017, DEC-020: minimal, colorless, Apple-like look; one fixed type scale.
- **E** DEC-079, DEC-080 (confirmed by DEC-083): no native popups. Every confirm is the in-app sheet, its button named for the
  action (Delete / Remove / Abandon / Replace), and Cancel sits on the left.
- **E** DEC-016, DEC-042: navigation is a link (‹ / ›), an action is a button; only DESIGN §4's verbs.
- **E** DEC-112: no bottom bar; every screen except Home has Back. **P** (DEC-112): the right-aligned "Today" link on deep
  screens, its label and where it sits.
- **P** DEC-092, DEC-051: a screen with more than one way in goes back to where you came from (`?from=`).
- **E** DEC-081 (confirmed by DEC-083): swipe-back skips screens that were replaced.
- **E** DEC-110 §2: routines are called "Workouts" on screen. **P**: "session" where a generic word is unavoidable.
- **E** DEC-058 §1, §6, §7: in kg a comma is a decimal point; in reps and duration a comma separates sets; fewer kg values
  than sets repeat the last one.
- **E** DEC-001, DEC-110 §1: a failed save shows a banner that stays, with its own Export button.
- **E** DEC-032, DEC-086: unreadable saved data is never overwritten; it gets its own banner.
- **E** DEC-029: another tab changing the data shows a warning asking you to reload. The two copies are never merged.
- **E** DEC-126: what a screen says is what you get.

## Home

- **E** DEC-113, DEC-114, DEC-115, top to bottom: "Workouts ›" → **Coming up**, the next 6 days, furthest on top, rest days
  muted ("{date} · Rest"), 2 workouts on one day share a row → today's block → "Schedule ›". No "Today" title.
  **P** (DEC-114): no gaps between sections, and the whole column sits at the bottom of a tall screen.
- **E** DEC-113: no Start on Coming-up rows; Start-ahead is on the day screen.
- **E** DEC-038, DEC-058 §2–3: one workout in progress at a time. While current (started today or within 6 h) it replaces
  today's Start; the day's other workouts stay visible with their own Start/Done.
- **E** DEC-038, DEC-110 §4: an older unfinished workout shows as a Continue row.
- **E** DEC-108 §5, DEC-119 §3: a workout done today sits in today's block as one line; 2+ startable workouts today share one
  Start that asks which.
- **E** DEC-119 §2: a workout done earlier in the same Mon–Sun week covers its next spot ("Done Tue ✓"). Display only.
- **E** DEC-125 §5: tapping today's workout opens a sheet with its exercises, Edit and **Swap for today** (one date only).
- **E** DEC-093: an empty Home says "Create your first routine".
- **E** DEC-115: History is 2 taps away (via Schedule); "Done ✓ — see your sets ›" opens today's session directly.

## Day screen (a scheduled day)

- **E** DEC-110 §4: **Start now**; the title is honest about the loop ("Saturday · week 2 of 2").
- **E** DEC-116, DEC-117 §2: "Change day". Opened from Home it moves that one date; opened from Schedule it moves the
  workout for every week.
- **E** DEC-126 §2: Change day on a swapped spot takes the swap with it.
- **E** DEC-114: a rest day's screen opens, and a workout can be added there.

## Schedule (whole plan)

- **E** DEC-115: reached from Home ("Schedule ›"); ends with "History ›".
- **E** DEC-117 §2: changes made here are permanent (every week).
- **E** DEC-126 §1: a slot always opens its own workout here, even on a day it's swapped.

## History

- **E** DESIGN §3, DEC-031: history is the record, kept apart from setup.
- **E** DEC-115: lives inside Schedule; Back goes to Schedule. **E** DEC-110 §1: "Backup & data ›" is the last row, even when
  History is empty.
- **E** DEC-050, DEC-117 §1: no "you beat last time" line and no ↑ N% here. It's a record, not a celebration.
- **E** DEC-117 §4: no Total lifted.
- **E** DEC-042: a workout's detail page offers "Edit" (replaced DEC-033's "Correct").
- **E** DEC-056: correcting a past workout can offer to update the routine. It's a choice, never automatic, and a blank
  shows "—", never 0.
- **E** DEC-087 §2: old warm-up and cardio sets hide "Moderate", and editing them shows no Effort.
- **E** DEC-038: an unfinished workout from an earlier day shows Continue + Abandon and never counts as done.
- **E** DEC-110 §3: By exercise links to that exercise's settings.

## Workouts list and a workout's own screen

- **E** DEC-110 §3, DEC-115: a plain list, each row with Start; "Your exercises ›" below.
- **E** DEC-119 §4: a new workout = its exercises + a name, no days. A "Days" row on the workout's own screen schedules it.
  "Use a plan" shows only when there are no workouts yet.
- **E** DEC-116: the default name is "New workout #N", and the name box is the last field, just above Save.
- **E** DEC-099: the form has exercise, sets, reps, kg, rest and a "Warm-up exercise" switch. No Focus, no warm-up set;
  plain words ("Rest (seconds)", "Different reps per set").
- **E** DEC-096 §2, §4: adding an exercise prefills its kg from history; kg belongs to each workout separately (Day A ≠ Day B).
- **E** DEC-097: the picker lists your exercises first (recent on top), then the whole library; an empty search shows staples
  grouped by muscle; multi-select with "Add N"; values come from history, or from a shown starting plan ("3 × 10, 90 s
  rest"), never kg; a near-duplicate asks "Use your 'Bench'?".
- **E** DEC-119 §5: an "Added:" strip above Add N; exercises already in the workout are marked.
- **E** DEC-031, DEC-058 §5, DEC-089: a delete names the schedule slots it removes. Anything used by history, the workout in
  progress or a finished workout is archived, not deleted, and the confirm says which.
- **E** DEC-056: the routine is never updated automatically at Finish.

## First-time setup

- **E** DEC-105: starts with "Which machines do you use?", then "How many days a week?". The app splits them across the days.
  "Not sure? Use a plan" offers the slot templates. A new plan starts today.
- **E** DEC-098: templates for 1–4 days only. **P** (DEC-098 §3): slots named in plain words; staples first; no Carry slot.
- **P** (DEC-105): the split rule and wording.

## Exercises (Your exercises, an exercise's page, new exercise, the library)

- **E** DEC-119 §5: Your exercises splits into "In your workouts" and "Not in a workout".
- **E** DEC-059 §2–4: the weight step is a number plus an "Alternating (4/5)" option, and imports leave it empty. Re-adding
  an archived exercise offers Restore. A duplicate name warns but allows it.
- **P** (DEC-108 §6): "Two step sizes", hidden for cardio; a "Lightest weight" field the suggestions count from.
- **E** DEC-060 §1, §5: pictures only on tap, never always shown; typing a new exercise suggests the library entry.
- **E** DEC-122 §2: dumbbell kg is one dumbbell; one-arm exercises say so plainly.
- **E** DEC-064 §2–3, DEC-066 §1: search uses only our library; staples first, the rest behind "Show more".
- **E** DEC-072 (confirmed by DEC-078): typing a merged entry's exact name finds the entry it was merged into.
- **P** DEC-067, DEC-077: library content (names, tags, text, staples, difficulty). Beginner-first, room for advanced.
- **E** DEC-062 §5 (not built yet, req-134): the muscle filter shows exercises for any chosen group by default, with a
  "must hit all" toggle.

## Workout: the exercise list

- **E** DEC-125 §2: Start opens the first exercise. Arriving from Start or from a review's Next shows an **Up next** bar with
  a 5 s countdown and Skip / Swap / Start now. Add exercise, the workout note and Abandon stay on the list.
- **E** DEC-103 §2: Swap and Skip exercise are on the list rows. Nothing about the routine's kg is shown in the list.
- **E** DEC-093: you can always get back to the list (its "no auto-jump" is replaced by DEC-125 §2's countdown bar).
- **E** DEC-013, DEC-014: an exercise is done when its last set is logged; adding a set to it reopens it.
- **E** DEC-117 §1: a done exercise shows "↑ N%", only on an improvement.
- **P** (DEC-117 §1): how the % is computed.
- **E** DEC-039: Back goes to Home and the workout stays in progress. Abandon is the only discard.
- **E** DEC-087 §2: a workout screen opened with no workout in progress goes to that workout's overview.
- **E** DEC-104, DEC-106, DEC-107 §1: a swapped-in or added exercise takes history's plan. With no history, Swap copies the
  replaced exercise's sets and rest, and Add asks Sets / Rest, prefilled 3 / 90. Kg and reps start blank.
- **P** (DEC-104 §3): several no-history picks share one step.
- **E** DEC-122 §1: notes during a workout wait for a redesign.

## Workout: logging a set

- **E** DEC-096 §1: kg comes from the routine; a blank in the routine stays blank.
- **E** DEC-102: blank kg + history shows a "Last time: 30 kg" hint, not a prefill. Blank kg on Done shows "No weight
  entered" and doesn't block. A kg more than 50% off shows "That's a big change from 50 kg".
- **E** DEC-052, DEC-107 §2, DEC-117 §3: a kg change carries to the remaining sets. Reps carry only when every set has the
  same target, or there is no target.
- **E** DEC-082 §2: an added set with nothing logged stays blank.
- **E** DEC-053: "last time" skips a workout where every working set of that exercise was skipped.
- **E** DEC-119 §1, DEC-125 §1: one **Done** per set, plus Skip set. Tapping a done set opens a sheet to edit it. After the
  last set comes the exercise review: the sets, ↑ N%, one effort (Easy · Medium · Hard, no Failure; tap again to clear).
- **E** DEC-103 §1: when the logged kg differs from the routine, the exercise's end asks "Use 25 kg next time in {workout}?"
  [Update routine] [Keep 20 kg]. Never automatic.
- **E** DEC-138, DEC-123 §1, DEC-012: a first-time exercise asks nothing; a quiet "Not sure what weight? Help me find it" link
  starts guided setup ("How was that?" after set 1 moves set 2's kg one step, editable, reason shown). The app never
  suggests a starting weight.
- **E** DEC-108 §4: cardio sets have a stopwatch, Level and Distance. **P** DEC-109: a single-time target prefills Duration;
  a range stays blank.
- **E** DEC-119 §6: one-arm reps read "each side"; the exercise note and form cues show during rest.
- **E** DEC-103 §4: the set list stays on screen, the current set highlighted. **P** (DEC-108 §6): the list sits under the
  exercise name; completed sets stay shown; the routine's exercise note shows.

## Workout: rest and the pill

- **E** DEC-048: rest is information, never a control, and never blocks the next set.
- **E** DEC-103 §3, DEC-125 §3, DEC-139: one pill for the whole workout, from the start, two lines: the countdown (then a
  glowing GO) over "Set 2 of 4 · Ex 3 of 7".
- **E** DEC-108 §3: tapping the pill on the current exercise's own screen skips the rest; anywhere else it opens that exercise.
- **E** DEC-023: rest ending plays a sound and vibrates, once. No setting to turn it off.
- **E** DEC-013 (req-25 refinement): logging a set starts rest, the last set included. **E** DEC-056: Skip exercise leaves a
  running rest going and never starts one.

## Workout: finish

- **E** DEC-058 §4: finishing with nothing logged warns and offers Abandon; auto-finish never saves an empty workout.
- **E** DEC-093: Finish lists unfinished exercises. **P** (DEC-094): exercises never started collapse; wording "1 set".
- **E** DEC-118, DEC-050: one "X ↑ N%" line per exercise that improved; never a "you did worse".
- **E** DEC-117 §4: no Total lifted.
- **E** DEC-125 §4: more than 3 h between the last set and Finish → the finish time is the last set's time, said plainly.
- **E** DEC-056: Finish never changes the routine. **E** DEC-038: Abandon discards the workout entirely.

## Backup & data, login and sync

- **E** DEC-110 §1: Export and Import first; Export analytics, Feedback notes and Components at the bottom.
- **E** DEC-123 §2: every Import shows a preview of what changes; if history changed: **Keep my history** (default) or
  **Replace everything**. **E** DEC-004: a destructive import downloads the current data first.
- **E** DEC-123 §3: "Export for your AI" under "Back up now", with a 3-line how-to. **P**: the how-to's wording.
- **E** DEC-086: with unreadable data, Import first keeps a copy on the device.
- **E** DEC-011: analytics are kept apart from workout data and exported from here.
- **E** DEC-127, DEC-128: Export/Import stay; offline-first, so having no signal never blocks logging.
- **E** DEC-132: first login takes the server's copy; one line says whether data reached the server; logout always allowed,
  data stays on the device; password ≥ 6 characters.
- **E** DEC-133: after a server restore, the workout in progress survives.
